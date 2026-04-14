import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:116
* @route '/api/settings/project-tour'
*/
export const set = (options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: set.url(options),
    method: 'put',
})

set.definition = {
    methods: ["put"],
    url: '/api/settings/project-tour',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:116
* @route '/api/settings/project-tour'
*/
set.url = (options?: RouteQueryOptions) => {
    return set.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:116
* @route '/api/settings/project-tour'
*/
set.put = (options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: set.url(options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\SettingsController::set
* @see app/Http/Controllers/SettingsController.php:116
* @route '/api/settings/project-tour'
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
* @see app/Http/Controllers/SettingsController.php:116
* @route '/api/settings/project-tour'
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

const projectTour = {
    set: Object.assign(set, set),
}

export default projectTour