import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:30
* @route '/api/settings/api-keys'
*/
export const get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: get.url(options),
    method: 'get',
})

get.definition = {
    methods: ["get","head"],
    url: '/api/settings/api-keys',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:30
* @route '/api/settings/api-keys'
*/
get.url = (options?: RouteQueryOptions) => {
    return get.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:30
* @route '/api/settings/api-keys'
*/
get.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: get.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:30
* @route '/api/settings/api-keys'
*/
get.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: get.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:30
* @route '/api/settings/api-keys'
*/
const getForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: get.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:30
* @route '/api/settings/api-keys'
*/
getForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: get.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:30
* @route '/api/settings/api-keys'
*/
getForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: get.url({
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
* @see app/Http/Controllers/SettingsController.php:39
* @route '/api/settings/api-keys'
*/
export const set = (options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: set.url(options),
    method: 'put',
})

set.definition = {
    methods: ["put"],
    url: '/api/settings/api-keys',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:39
* @route '/api/settings/api-keys'
*/
set.url = (options?: RouteQueryOptions) => {
    return set.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:39
* @route '/api/settings/api-keys'
*/
set.put = (options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: set.url(options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:39
* @route '/api/settings/api-keys'
*/
const setForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: set.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:39
* @route '/api/settings/api-keys'
*/
setForm.put = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: set.url({
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
* @see app/Http/Controllers/SettingsController.php:123
* @route '/api/settings/api-keys'
*/
export const deleteMethod = (options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: deleteMethod.url(options),
    method: 'delete',
})

deleteMethod.definition = {
    methods: ["delete"],
    url: '/api/settings/api-keys',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\SettingsController::deleteMethod
* @see app/Http/Controllers/SettingsController.php:123
* @route '/api/settings/api-keys'
*/
deleteMethod.url = (options?: RouteQueryOptions) => {
    return deleteMethod.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SettingsController::deleteMethod
* @see app/Http/Controllers/SettingsController.php:123
* @route '/api/settings/api-keys'
*/
deleteMethod.delete = (options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: deleteMethod.url(options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\SettingsController::deleteMethod
* @see app/Http/Controllers/SettingsController.php:123
* @route '/api/settings/api-keys'
*/
const deleteMethodForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: deleteMethod.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\SettingsController::deleteMethod
* @see app/Http/Controllers/SettingsController.php:123
* @route '/api/settings/api-keys'
*/
deleteMethodForm.delete = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: deleteMethod.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

deleteMethod.form = deleteMethodForm

const apiKeys = {
    get: Object.assign(get, get),
    set: Object.assign(set, set),
    delete: Object.assign(deleteMethod, deleteMethod),
}

export default apiKeys