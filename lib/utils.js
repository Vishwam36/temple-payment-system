import { cache } from "react"
import { ROLES_DB, STAGE_OWNER_ROLES, GLOBAL_ROLES, TERMINAL_STATUSES } from "./constants"
import { createAdminServerClient, createServerClient } from "./supabase/server"

// The lookups below are wrapped in React cache(): within one server render (a layout and
// its page) each runs at most once, instead of once per caller. The cache is scoped to a
// single request, so nothing is shared between users or carried over to a later request
// — every navigation and router.refresh() still reads fresh data. Outside a render (Route
// Handlers) cache() is a pass-through.

// The signed-in user, verified with the Auth server (not just the JWT in the cookie).
export const getSessionUser = cache(async () => {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
})

export const getUserRolesAndScopes = cache(async (userId) => {
    const admin = createAdminServerClient()
    const { data: roleRows } = await admin
        .from('user_roles')
        .select('role, department')
        .eq('profile_id', userId)

    return roleRows
})

export const isUserGlobalScoper = (roleRows) => {
    return roleRows.some(r => GLOBAL_ROLES.includes(r.role))
}

export const getComDepartments = (roleRows) => {
    return roleRows.filter(r => r.role === ROLES_DB.department_com && r.department).map(r => r.department)
}

// Roles allowed to act on a request currently at `status`, given its department.
// super_admin always has authority; department_com is scoped to its own department.
export const hasStageAuthority = (roleRows, status, department) => {
    const ownerRoles = STAGE_OWNER_ROLES[status] || []
    return roleRows.some(r => {
        if (r.role === ROLES_DB.super_admin) return true
        if (r.role === ROLES_DB.department_com) return ownerRoles.includes(r.role) && r.department === department
        return ownerRoles.includes(r.role)
    })
}

// True when the request is still open and waiting on this user — drives the "My Queue" views.
export const isAwaitingUserAction = (roleRows, req) => {
    return !TERMINAL_STATUSES.includes(req.status) && hasStageAuthority(roleRows, req.status, req.department)
}

// The requests currently awaiting this user's action (My Queue) — the same
// isAwaitingUserAction rule the requests list uses. No visibility filter is needed: stage
// authority already implies the user can see the request (global role, or COM of its
// department). Applicant-only users never have stage authority, so skip the query.
export const getMyQueue = async (roleRows) => {
    if (!roleRows?.some(r => r.role !== ROLES_DB.applicant)) return []
    const data = await getOpenRequests()
    return (data || []).filter(r => isAwaitingUserAction(roleRows, r))
}

// Every open request (queue candidates). Server-only; callers filter by stage authority.
const getOpenRequests = cache(async () => {
    const admin = createAdminServerClient()
    const { data } = await admin
        .from('payment_requests')
        .select('id, status, department, amount, created_at')
        .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`)
        .order('created_at', { ascending: false })
    return data
})

// Starts the lookups every app layout needs as soon as the user is known, so they run in
// parallel with the profile check instead of one after another. Nothing is returned or
// exposed here; callers still await getUserRolesAndScopes / getMyQueue (served from cache).
export const preloadViewerData = (userId) => {
    void getUserRolesAndScopes(userId)
    void getOpenRequests()
}

// Resolves which of a user's role rows is the one governing a request in `department`.
// Global roles (super_admin/supervisor/accounts_head/passing_authority) take priority;
// otherwise falls back to a department_com row scoped to that specific department.
export const getMatchingRoleRow = (roleRows, department) => {
    return roleRows?.find(r => {
        if (GLOBAL_ROLES.includes(r.role)) return true
        if (r.role === ROLES_DB.department_com && r.department === department) return true
        return false
    })
}

// Resolves the role row a user is acting under for a request at `status`. A user may
// hold several roles (e.g. supervisor + accounts_head), so the stage's actual owner role
// wins, then super_admin; otherwise falls back to getMatchingRoleRow for display purposes.
export const getStageActingRoleRow = (roleRows, status, department) => {
    const ownerRoles = STAGE_OWNER_ROLES[status] || []
    return roleRows?.find(r => ownerRoles.includes(r.role) && (r.role !== ROLES_DB.department_com || r.department === department))
        || roleRows?.find(r => r.role === ROLES_DB.super_admin)
        || getMatchingRoleRow(roleRows, department)
}

// Guards every protected page against stale sessions: a browser can still hold a
// valid auth cookie/JWT for a user whose `profiles` row has since been deleted
// (removed outside the admin UI's role-revocation flow). In that case the caller
// should treat it exactly like "not logged in" — redirect to /login — rather than
// rendering a page for an identity that no longer exists in the app.
export const requireActiveProfile = cache(async () => {
    const user = await getSessionUser()
    if (!user) return { user: null, profile: null }
    preloadViewerData(user.id)

    const admin = createAdminServerClient()
    const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single()

    if (!profile) {
        // Clear the now-orphaned session so the browser stops presenting it.
        const supabase = await createServerClient()
        await supabase.auth.signOut()
        return { user: null, profile: null }
    }

    return { user, profile }
})

// Builds a consistent, self-explanatory note for hold/reject actions: who did it,
// their stated reason, and a closing action line telling the applicant what to do next.
export const composeStatusNote = ({ headerVerb, reason, actorLabel, actorName, closingLine }) => {
    const who = actorName ? `${actorLabel} (${actorName})` : actorLabel
    return [
        `This request was ${headerVerb} by ${who}.`,
        reason,
        closingLine,
    ].filter(Boolean).join('\n\n')
}