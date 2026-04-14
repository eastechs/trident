import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../wayfinder'
import autosave from './autosave'
import notifications from './notifications'
import trash from './trash'
import projectTour from './project-tour'
import apiKeys from './api-keys'
import agentInstructions from './agent-instructions'
/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/settings'
*/
export const view = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: view.url(options),
    method: 'get',
})

view.definition = {
    methods: ["get","head"],
    url: '/settings',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/settings'
*/
view.url = (options?: RouteQueryOptions) => {
    return view.definition.url + queryParams(options)
}

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/settings'
*/
view.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: view.url(options),
    method: 'get',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/settings'
*/
view.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: view.url(options),
    method: 'head',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/settings'
*/
const viewForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: view.url(options),
    method: 'get',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/settings'
*/
viewForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: view.url(options),
    method: 'get',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/settings'
*/
viewForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: view.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

view.form = viewForm

const settings = {
    autosave: Object.assign(autosave, autosave),
    notifications: Object.assign(notifications, notifications),
    trash: Object.assign(trash, trash),
    projectTour: Object.assign(projectTour, projectTour),
    apiKeys: Object.assign(apiKeys, apiKeys),
    agentInstructions: Object.assign(agentInstructions, agentInstructions),
    view: Object.assign(view, view),
}

export default settings