import { ROLES_DB, STAGE_OWNER_ROLES } from "./constants"
import { createAdminServerClient } from "./supabase/server"

export const getUserRolesAndScopes = async (userId) => {
    const admin = createAdminServerClient()
    const { data: roleRows } = await admin
        .from('user_roles')
        .select('role, department')
        .eq('profile_id', userId)

    return roleRows
}

export const isUserGlobalScoper = (roleRows) => {
    return roleRows.some(r => [ROLES_DB.super_admin, ROLES_DB.accounts_head, ROLES_DB.passing_authority].includes(r.role))
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

// Resolves which of a user's role rows is the one governing a request in `department`.
// Global roles (super_admin/accounts_head/passing_authority) take priority; otherwise
// falls back to a department_com row scoped to that specific department.
export const getMatchingRoleRow = (roleRows, department) => {
    return roleRows?.find(r => {
        if ([ROLES_DB.super_admin, ROLES_DB.accounts_head, ROLES_DB.passing_authority].includes(r.role)) return true
        if (r.role === ROLES_DB.department_com && r.department === department) return true
        return false
    })
}