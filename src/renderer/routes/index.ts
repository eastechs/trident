import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../wayfinder'
/**
* @see \App\Http\Controllers\ProjectController::main
* @see app/Http/Controllers/ProjectController.php:34
* @route '/'
*/
export const main = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: main.url(options),
    method: 'get',
})

main.definition = {
    methods: ["get","head"],
    url: '/',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ProjectController::main
* @see app/Http/Controllers/ProjectController.php:34
* @route '/'
*/
main.url = (options?: RouteQueryOptions) => {
    return main.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ProjectController::main
* @see app/Http/Controllers/ProjectController.php:34
* @route '/'
*/
main.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: main.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ProjectController::main
* @see app/Http/Controllers/ProjectController.php:34
* @route '/'
*/
main.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: main.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ProjectController::main
* @see app/Http/Controllers/ProjectController.php:34
* @route '/'
*/
const mainForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: main.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ProjectController::main
* @see app/Http/Controllers/ProjectController.php:34
* @route '/'
*/
mainForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: main.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ProjectController::main
* @see app/Http/Controllers/ProjectController.php:34
* @route '/'
*/
mainForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: main.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

main.form = mainForm

/**
* @see \App\Http\Controllers\ProjectController::selectDirectory
* @see app/Http/Controllers/ProjectController.php:24
* @route '/select-directory'
*/
export const selectDirectory = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: selectDirectory.url(options),
    method: 'post',
})

selectDirectory.definition = {
    methods: ["post"],
    url: '/select-directory',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ProjectController::selectDirectory
* @see app/Http/Controllers/ProjectController.php:24
* @route '/select-directory'
*/
selectDirectory.url = (options?: RouteQueryOptions) => {
    return selectDirectory.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ProjectController::selectDirectory
* @see app/Http/Controllers/ProjectController.php:24
* @route '/select-directory'
*/
selectDirectory.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: selectDirectory.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ProjectController::selectDirectory
* @see app/Http/Controllers/ProjectController.php:24
* @route '/select-directory'
*/
const selectDirectoryForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: selectDirectory.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ProjectController::selectDirectory
* @see app/Http/Controllers/ProjectController.php:24
* @route '/select-directory'
*/
selectDirectoryForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: selectDirectory.url(options),
    method: 'post',
})

selectDirectory.form = selectDirectoryForm

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/documentation'
*/
export const documentation = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: documentation.url(options),
    method: 'get',
})

documentation.definition = {
    methods: ["get","head"],
    url: '/documentation',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/documentation'
*/
documentation.url = (options?: RouteQueryOptions) => {
    return documentation.definition.url + queryParams(options)
}

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/documentation'
*/
documentation.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: documentation.url(options),
    method: 'get',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/documentation'
*/
documentation.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: documentation.url(options),
    method: 'head',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/documentation'
*/
const documentationForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: documentation.url(options),
    method: 'get',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/documentation'
*/
documentationForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: documentation.url(options),
    method: 'get',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/documentation'
*/
documentationForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: documentation.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

documentation.form = documentationForm

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/onboarding'
*/
export const onboarding = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: onboarding.url(options),
    method: 'get',
})

onboarding.definition = {
    methods: ["get","head"],
    url: '/onboarding',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/onboarding'
*/
onboarding.url = (options?: RouteQueryOptions) => {
    return onboarding.definition.url + queryParams(options)
}

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/onboarding'
*/
onboarding.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: onboarding.url(options),
    method: 'get',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/onboarding'
*/
onboarding.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: onboarding.url(options),
    method: 'head',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/onboarding'
*/
const onboardingForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: onboarding.url(options),
    method: 'get',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/onboarding'
*/
onboardingForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: onboarding.url(options),
    method: 'get',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/onboarding'
*/
onboardingForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: onboarding.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

onboarding.form = onboardingForm

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/menubar'
*/
export const menubar = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: menubar.url(options),
    method: 'get',
})

menubar.definition = {
    methods: ["get","head"],
    url: '/menubar',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/menubar'
*/
menubar.url = (options?: RouteQueryOptions) => {
    return menubar.definition.url + queryParams(options)
}

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/menubar'
*/
menubar.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: menubar.url(options),
    method: 'get',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/menubar'
*/
menubar.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: menubar.url(options),
    method: 'head',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/menubar'
*/
const menubarForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: menubar.url(options),
    method: 'get',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/menubar'
*/
menubarForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: menubar.url(options),
    method: 'get',
})

/**
* @see \Inertia\Controller::__invoke
* @see vendor/inertiajs/inertia-laravel/src/Controller.php:13
* @route '/menubar'
*/
menubarForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: menubar.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

menubar.form = menubarForm
