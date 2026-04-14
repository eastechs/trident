import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:134
* @route '/api/settings/agent-instructions/{agentKey}'
*/
export const get = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: get.url(args, options),
    method: 'get',
})

get.definition = {
    methods: ["get","head"],
    url: '/api/settings/agent-instructions/{agentKey}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:134
* @route '/api/settings/agent-instructions/{agentKey}'
*/
get.url = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { agentKey: args }
    }

    if (Array.isArray(args)) {
        args = {
            agentKey: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        agentKey: args.agentKey,
    }

    return get.definition.url
            .replace('{agentKey}', parsedArgs.agentKey.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:134
* @route '/api/settings/agent-instructions/{agentKey}'
*/
get.get = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: get.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:134
* @route '/api/settings/agent-instructions/{agentKey}'
*/
get.head = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: get.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:134
* @route '/api/settings/agent-instructions/{agentKey}'
*/
const getForm = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: get.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:134
* @route '/api/settings/agent-instructions/{agentKey}'
*/
getForm.get = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: get.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:134
* @route '/api/settings/agent-instructions/{agentKey}'
*/
getForm.head = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: get.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

get.form = getForm

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:147
* @route '/api/settings/agent-instructions/{agentKey}'
*/
export const set = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: set.url(args, options),
    method: 'put',
})

set.definition = {
    methods: ["put"],
    url: '/api/settings/agent-instructions/{agentKey}',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:147
* @route '/api/settings/agent-instructions/{agentKey}'
*/
set.url = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { agentKey: args }
    }

    if (Array.isArray(args)) {
        args = {
            agentKey: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        agentKey: args.agentKey,
    }

    return set.definition.url
            .replace('{agentKey}', parsedArgs.agentKey.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:147
* @route '/api/settings/agent-instructions/{agentKey}'
*/
set.put = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: set.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:147
* @route '/api/settings/agent-instructions/{agentKey}'
*/
const setForm = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: set.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:147
* @route '/api/settings/agent-instructions/{agentKey}'
*/
setForm.put = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: set.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

set.form = setForm

/**
* @see \App\Http\Controllers\SettingsController::deleteMethod
* @see app/Http/Controllers/SettingsController.php:160
* @route '/api/settings/agent-instructions/{agentKey}'
*/
export const deleteMethod = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: deleteMethod.url(args, options),
    method: 'delete',
})

deleteMethod.definition = {
    methods: ["delete"],
    url: '/api/settings/agent-instructions/{agentKey}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\SettingsController::deleteMethod
* @see app/Http/Controllers/SettingsController.php:160
* @route '/api/settings/agent-instructions/{agentKey}'
*/
deleteMethod.url = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { agentKey: args }
    }

    if (Array.isArray(args)) {
        args = {
            agentKey: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        agentKey: args.agentKey,
    }

    return deleteMethod.definition.url
            .replace('{agentKey}', parsedArgs.agentKey.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\SettingsController::deleteMethod
* @see app/Http/Controllers/SettingsController.php:160
* @route '/api/settings/agent-instructions/{agentKey}'
*/
deleteMethod.delete = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: deleteMethod.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\SettingsController::deleteMethod
* @see app/Http/Controllers/SettingsController.php:160
* @route '/api/settings/agent-instructions/{agentKey}'
*/
const deleteMethodForm = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: deleteMethod.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\SettingsController::deleteMethod
* @see app/Http/Controllers/SettingsController.php:160
* @route '/api/settings/agent-instructions/{agentKey}'
*/
deleteMethodForm.delete = (args: { agentKey: string | number } | [agentKey: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: deleteMethod.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

deleteMethod.form = deleteMethodForm

const agentInstructions = {
    get: Object.assign(get, get),
    set: Object.assign(set, set),
    delete: Object.assign(deleteMethod, deleteMethod),
}

export default agentInstructions