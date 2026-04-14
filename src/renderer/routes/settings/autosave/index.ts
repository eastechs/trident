import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:15
* @route '/api/settings/autosave'
*/
export const get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: get.url(options),
    method: 'get',
})

get.definition = {
    methods: ["get","head"],
    url: '/api/settings/autosave',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:15
* @route '/api/settings/autosave'
*/
get.url = (options?: RouteQueryOptions) => {
    return get.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:15
* @route '/api/settings/autosave'
*/
get.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: get.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:15
* @route '/api/settings/autosave'
*/
get.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: get.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:15
* @route '/api/settings/autosave'
*/
const getForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: get.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:15
* @route '/api/settings/autosave'
*/
getForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: get.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\SettingsController::get
* @see app/Http/Controllers/SettingsController.php:15
* @route '/api/settings/autosave'
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
* @see app/Http/Controllers/SettingsController.php:22
* @route '/api/settings/autosave'
*/
export const set = (options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: set.url(options),
    method: 'put',
})

set.definition = {
    methods: ["put"],
    url: '/api/settings/autosave',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:22
* @route '/api/settings/autosave'
*/
set.url = (options?: RouteQueryOptions) => {
    return set.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:22
* @route '/api/settings/autosave'
*/
set.put = (options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: set.url(options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:22
* @route '/api/settings/autosave'
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
* @see app/Http/Controllers/SettingsController.php:22
* @route '/api/settings/autosave'
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

const autosave = {
    get: Object.assign(get, get),
    set: Object.assign(set, set),
}

export default autosave