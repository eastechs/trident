import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../wayfinder'
/**
* @see \App\Http\Controllers\ConversationController::index
* @see app/Http/Controllers/ConversationController.php:13
* @route '/projects/{project}/conversations'
*/
export const index = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(args, options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/projects/{project}/conversations',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ConversationController::index
* @see app/Http/Controllers/ConversationController.php:13
* @route '/projects/{project}/conversations'
*/
index.url = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions) => {
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

    return index.definition.url
            .replace('{project}', parsedArgs.project.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ConversationController::index
* @see app/Http/Controllers/ConversationController.php:13
* @route '/projects/{project}/conversations'
*/
index.get = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ConversationController::index
* @see app/Http/Controllers/ConversationController.php:13
* @route '/projects/{project}/conversations'
*/
index.head = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ConversationController::index
* @see app/Http/Controllers/ConversationController.php:13
* @route '/projects/{project}/conversations'
*/
const indexForm = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ConversationController::index
* @see app/Http/Controllers/ConversationController.php:13
* @route '/projects/{project}/conversations'
*/
indexForm.get = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ConversationController::index
* @see app/Http/Controllers/ConversationController.php:13
* @route '/projects/{project}/conversations'
*/
indexForm.head = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

index.form = indexForm

/**
* @see \App\Http\Controllers\ConversationController::store
* @see app/Http/Controllers/ConversationController.php:20
* @route '/projects/{project}/conversations'
*/
export const store = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/projects/{project}/conversations',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ConversationController::store
* @see app/Http/Controllers/ConversationController.php:20
* @route '/projects/{project}/conversations'
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
* @see \App\Http\Controllers\ConversationController::store
* @see app/Http/Controllers/ConversationController.php:20
* @route '/projects/{project}/conversations'
*/
store.post = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ConversationController::store
* @see app/Http/Controllers/ConversationController.php:20
* @route '/projects/{project}/conversations'
*/
const storeForm = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ConversationController::store
* @see app/Http/Controllers/ConversationController.php:20
* @route '/projects/{project}/conversations'
*/
storeForm.post = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(args, options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\ConversationController::update
* @see app/Http/Controllers/ConversationController.php:45
* @route '/projects/{project}/conversations/{conversation}'
*/
export const update = (args: { project: string | { id: string }, conversation: string | number } | [project: string | { id: string }, conversation: string | number ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/projects/{project}/conversations/{conversation}',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\ConversationController::update
* @see app/Http/Controllers/ConversationController.php:45
* @route '/projects/{project}/conversations/{conversation}'
*/
update.url = (args: { project: string | { id: string }, conversation: string | number } | [project: string | { id: string }, conversation: string | number ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            project: args[0],
            conversation: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        project: typeof args.project === 'object'
        ? args.project.id
        : args.project,
        conversation: args.conversation,
    }

    return update.definition.url
            .replace('{project}', parsedArgs.project.toString())
            .replace('{conversation}', parsedArgs.conversation.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ConversationController::update
* @see app/Http/Controllers/ConversationController.php:45
* @route '/projects/{project}/conversations/{conversation}'
*/
update.patch = (args: { project: string | { id: string }, conversation: string | number } | [project: string | { id: string }, conversation: string | number ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\ConversationController::update
* @see app/Http/Controllers/ConversationController.php:45
* @route '/projects/{project}/conversations/{conversation}'
*/
const updateForm = (args: { project: string | { id: string }, conversation: string | number } | [project: string | { id: string }, conversation: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ConversationController::update
* @see app/Http/Controllers/ConversationController.php:45
* @route '/projects/{project}/conversations/{conversation}'
*/
updateForm.patch = (args: { project: string | { id: string }, conversation: string | number } | [project: string | { id: string }, conversation: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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
* @see \App\Http\Controllers\ConversationController::destroy
* @see app/Http/Controllers/ConversationController.php:73
* @route '/projects/{project}/conversations/{conversation}'
*/
export const destroy = (args: { project: string | { id: string }, conversation: string | number } | [project: string | { id: string }, conversation: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/projects/{project}/conversations/{conversation}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\ConversationController::destroy
* @see app/Http/Controllers/ConversationController.php:73
* @route '/projects/{project}/conversations/{conversation}'
*/
destroy.url = (args: { project: string | { id: string }, conversation: string | number } | [project: string | { id: string }, conversation: string | number ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            project: args[0],
            conversation: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        project: typeof args.project === 'object'
        ? args.project.id
        : args.project,
        conversation: args.conversation,
    }

    return destroy.definition.url
            .replace('{project}', parsedArgs.project.toString())
            .replace('{conversation}', parsedArgs.conversation.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ConversationController::destroy
* @see app/Http/Controllers/ConversationController.php:73
* @route '/projects/{project}/conversations/{conversation}'
*/
destroy.delete = (args: { project: string | { id: string }, conversation: string | number } | [project: string | { id: string }, conversation: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\ConversationController::destroy
* @see app/Http/Controllers/ConversationController.php:73
* @route '/projects/{project}/conversations/{conversation}'
*/
const destroyForm = (args: { project: string | { id: string }, conversation: string | number } | [project: string | { id: string }, conversation: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ConversationController::destroy
* @see app/Http/Controllers/ConversationController.php:73
* @route '/projects/{project}/conversations/{conversation}'
*/
destroyForm.delete = (args: { project: string | { id: string }, conversation: string | number } | [project: string | { id: string }, conversation: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const conversations = {
    index: Object.assign(index, index),
    store: Object.assign(store, store),
    update: Object.assign(update, update),
    destroy: Object.assign(destroy, destroy),
}

export default conversations