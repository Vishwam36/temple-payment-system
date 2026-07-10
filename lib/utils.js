import { ROLES_DB } from "./constants"
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
    return roleRows.filter(r => r.role === ROLES_DB.com_member && r.department).map(r => r.department)
}

export const isUserOwner = (roleRows, userId) => {
    return roleRows.some(r => r.profile_id === userId)
}