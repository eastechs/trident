import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:86
* @route '/api/settings/notifications'
*/
export const get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: get.url(options),
    method: 'get',
})

get.definition = {
    methods: ["get","head"],
    url: '/api/settings/notifications',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:86
* @route '/api/settings/notifications'
*/
get.url = (options?: RouteQueryOptions) => {
    return get.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:86
* @route '/api/settings/notifications'
*/
get.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: get.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:86
* @route '/api/settings/notifications'
*/
get.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: get.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:86
* @route '/api/settings/notifications'
*/
const getForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: get.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:86
* @route '/api/settings/notifications'
*/
getForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: get.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:86
* @route '/api/settings/notifications'
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
* @see app/Http/Controllers/SettingsController.php:93
* @route '/api/settings/notifications'
*/
export const set = (options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: set.url(options),
    method: 'put',
})

set.definition = {
    methods: ["put"],
    url: '/api/settings/notifications',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:93
* @route '/api/settings/notifications'
*/
set.url = (options?: RouteQueryOptions) => {
    return set.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:93
* @route '/api/settings/notifications'
*/
set.put = (options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: set.url(options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:93
* @route '/api/settings/notifications'
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
* @see app/Http/Controllers/SettingsController.php:93
* @route '/api/settings/notifications'
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

const notifications = {
    get: Object.assign(get, get),
    set: Object.assign(set, set),
}

export default notifications