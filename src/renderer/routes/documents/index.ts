import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../wayfinder'
/**
* @see \App\Http\Controllers\DocumentController::store
* @see app/Http/Controllers/DocumentController.php:15
* @route '/projects/{project}/documents'
*/
export const store = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/projects/{project}/documents',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\DocumentController::store
* @see app/Http/Controllers/DocumentController.php:15
* @route '/projects/{project}/documents'
*/
store.url = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { project: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { project: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            project: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        project: typeof args.project === 'object'
        ? args.project.id
        : args.project,
    }

    return store.definition.url
            .replace('{project}', parsedArgs.project.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\DocumentController::store
* @see app/Http/Controllers/DocumentController.php:15
* @route '/projects/{project}/documents'
*/
store.post = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\DocumentController::store
* @see app/Http/Controllers/DocumentController.php:15
* @route '/projects/{project}/documents'
*/
const storeForm = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\DocumentController::store
* @see app/Http/Controllers/DocumentController.php:15
* @route '/projects/{project}/documents'
*/
storeForm.post = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(args, options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\DocumentController::update
* @see app/Http/Controllers/DocumentController.php:54
* @route '/projects/{project}/documents/{document}'
*/
export const update = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/projects/{project}/documents/{document}',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\DocumentController::update
* @see app/Http/Controllers/DocumentController.php:54
* @route '/projects/{project}/documents/{document}'
*/
update.url = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            project: args[0],
            document: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        project: typeof args.project === 'object'
        ? args.project.id
        : args.project,
        document: typeof args.document === 'object'
        ? args.document.id
        : args.document,
    }

    return update.definition.url
            .replace('{project}', parsedArgs.project.toString())
            .replace('{document}', parsedArgs.document.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\DocumentController::update
* @see app/Http/Controllers/DocumentController.php:54
* @route '/projects/{project}/documents/{document}'
*/
update.patch = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\DocumentController::update
* @see app/Http/Controllers/DocumentController.php:54
* @route '/projects/{project}/documents/{document}'
*/
const updateForm = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\DocumentController::update
* @see app/Http/Controllers/DocumentController.php:54
* @route '/projects/{project}/documents/{document}'
*/
updateForm.patch = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

update.form = updateForm

/**
* @see \App\Http\Controllers\DocumentController::show
* @see app/Http/Controllers/DocumentController.php:89
* @route '/projects/{project}/documents/{document}'
*/
export const show = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/projects/{project}/documents/{document}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\DocumentController::show
* @see app/Http/Controllers/DocumentController.php:89
* @route '/projects/{project}/documents/{document}'
*/
show.url = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            project: args[0],
            document: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        project: typeof args.project === 'object'
        ? args.project.id
        : args.project,
        document: typeof args.document === 'object'
        ? args.document.id
        : args.document,
    }

    return show.definition.url
            .replace('{project}', parsedArgs.project.toString())
            .replace('{document}', parsedArgs.document.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\DocumentController::show
* @see app/Http/Controllers/DocumentController.php:89
* @route '/projects/{project}/documents/{document}'
*/
show.get = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\DocumentController::show
* @see app/Http/Controllers/DocumentController.php:89
* @route '/projects/{project}/documents/{document}'
*/
show.head = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\DocumentController::show
* @see app/Http/Controllers/DocumentController.php:89
* @route '/projects/{project}/documents/{document}'
*/
const showForm = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\DocumentController::show
* @see app/Http/Controllers/DocumentController.php:89
* @route '/projects/{project}/documents/{document}'
*/
showForm.get = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\DocumentController::show
* @see app/Http/Controllers/DocumentController.php:89
* @route '/projects/{project}/documents/{document}'
*/
showForm.head = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

show.form = showForm

/**
* @see \App\Http\Controllers\DocumentController::updateContent
* @see app/Http/Controllers/DocumentController.php:100
* @route '/projects/{project}/documents/{document}/content'
*/
export const updateContent = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: updateContent.url(args, options),
    method: 'put',
})

updateContent.definition = {
    methods: ["put"],
    url: '/projects/{project}/documents/{document}/content',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\DocumentController::updateContent
* @see app/Http/Controllers/DocumentController.php:100
* @route '/projects/{project}/documents/{document}/content'
*/
updateContent.url = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            project: args[0],
            document: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        project: typeof args.project === 'object'
        ? args.project.id
        : args.project,
        document: typeof args.document === 'object'
        ? args.document.id
        : args.document,
    }

    return updateContent.definition.url
            .replace('{project}', parsedArgs.project.toString())
            .replace('{document}', parsedArgs.document.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\DocumentController::updateContent
* @see app/Http/Controllers/DocumentController.php:100
* @route '/projects/{project}/documents/{document}/content'
*/
updateContent.put = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: updateContent.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\DocumentController::updateContent
* @see app/Http/Controllers/DocumentController.php:100
* @route '/projects/{project}/documents/{document}/content'
*/
const updateContentForm = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: updateContent.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\DocumentController::updateContent
* @see app/Http/Controllers/DocumentController.php:100
* @route '/projects/{project}/documents/{document}/content'
*/
updateContentForm.put = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: updateContent.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

updateContent.form = updateContentForm

/**
* @see \App\Http\Controllers\DocumentController::destroy
* @see app/Http/Controllers/DocumentController.php:118
* @route '/projects/{project}/documents/{document}'
*/
export const destroy = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/projects/{project}/documents/{document}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\DocumentController::destroy
* @see app/Http/Controllers/DocumentController.php:118
* @route '/projects/{project}/documents/{document}'
*/
destroy.url = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            project: args[0],
            document: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        project: typeof args.project === 'object'
        ? args.project.id
        : args.project,
        document: typeof args.document === 'object'
        ? args.document.id
        : args.document,
    }

    return destroy.definition.url
            .replace('{project}', parsedArgs.project.toString())
            .replace('{document}', parsedArgs.document.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\DocumentController::destroy
* @see app/Http/Controllers/DocumentController.php:118
* @route '/projects/{project}/documents/{document}'
*/
destroy.delete = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\DocumentController::destroy
* @see app/Http/Controllers/DocumentController.php:118
* @route '/projects/{project}/documents/{document}'
*/
const destroyForm = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\DocumentController::destroy
* @see app/Http/Controllers/DocumentController.php:118
* @route '/projects/{project}/documents/{document}'
*/
destroyForm.delete = (args: { project: string | { id: string }, document: string | { id: string } } | [project: string | { id: string }, document: string | { id: string } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const documents = {
    store: Object.assign(store, store),
    update: Object.assign(update, update),
    show: Object.assign(show, show),
    updateContent: Object.assign(updateContent, updateContent),
    destroy: Object.assign(destroy, destroy),
}

export default documents