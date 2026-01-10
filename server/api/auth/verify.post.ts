export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const config = useRuntimeConfig()

    if (!config.accessPin) {
        // If no PIN configured, allow access (or handle as error, but here allow for dev safety if forgot env)
        // But better to be strict implies "protection".
        // Let's assume matches if PIN is correct.
        return { success: false, message: 'Server configuration error' }
    }

    if (body.pin === config.accessPin) {
        return { success: true }
    }

    throw createError({
        statusCode: 401,
        statusMessage: 'รหัสผ่านไม่ถูกต้อง'
    })
})
