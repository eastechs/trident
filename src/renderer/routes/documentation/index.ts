import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../wayfinder'
/**
* @see \App\Http\Controllers\DocumentationController::open
* @see app/Http/Controllers/DocumentationController.php:10
* @route '/documentation/open'
*/
export const open = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: open.url(options),
    method: 'post',
})

open.definition = {
    methods: ["post"],
    url: '/documentation/open',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\DocumentationController::open
* @see app/Http/Controllers/DocumentationController.php:10
* @route '/documentation/open'
*/
open.url = (options?: RouteQueryOptions) => {
    return open.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\DocumentationController::open
* @see app/Http/Controllers/DocumentationController.php:10
* @route '/documentation/open'
*/
open.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: open.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\DocumentationController::open
* @see app/Http/Controllers/DocumentationController.php:10
* @route '/documentation/open'
*/
const openForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: open.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\DocumentationController::open
* @see app/Http/Controllers/DocumentationController.php:10
* @route '/documentation/open'
*/
openForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: open.url(options),
    method: 'post',
})

open.form = openForm

const documentation = {
    open: Object.assign(open, open),
}

export default documentation