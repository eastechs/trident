import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../wayfinder'
/**
* @see \App\Http\Controllers\ChatController::send
* @see app/Http/Controllers/ChatController.php:21
* @route '/projects/{project}/chat'
*/
export const send = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: send.url(args, options),
    method: 'post',
})

send.definition = {
    methods: ["post"],
    url: '/projects/{project}/chat',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ChatController::send
* @see app/Http/Controllers/ChatController.php:21
* @route '/projects/{project}/chat'
*/
send.url = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions) => {
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

    return send.definition.url
            .replace('{project}', parsedArgs.project.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ChatController::send
* @see app/Http/Controllers/ChatController.php:21
* @route '/projects/{project}/chat'
*/
send.post = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: send.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ChatController::send
* @see app/Http/Controllers/ChatController.php:21
* @route '/projects/{project}/chat'
*/
const sendForm = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: send.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ChatController::send
* @see app/Http/Controllers/ChatController.php:21
* @route '/projects/{project}/chat'
*/
sendForm.post = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: send.url(args, options),
    method: 'post',
})

send.form = sendForm

/**
* @see \App\Http\Controllers\ChatController::messages
* @see app/Http/Controllers/ChatController.php:92
* @route '/projects/{project}/chat/messages'
*/
export const messages = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: messages.url(args, options),
    method: 'get',
})

messages.definition = {
    methods: ["get","head"],
    url: '/projects/{project}/chat/messages',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ChatController::messages
* @see app/Http/Controllers/ChatController.php:92
* @route '/projects/{project}/chat/messages'
*/
messages.url = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions) => {
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

    return messages.definition.url
            .replace('{project}', parsedArgs.project.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ChatController::messages
* @see app/Http/Controllers/ChatController.php:92
* @route '/projects/{project}/chat/messages'
*/
messages.get = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: messages.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ChatController::messages
* @see app/Http/Controllers/ChatController.php:92
* @route '/projects/{project}/chat/messages'
*/
messages.head = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: messages.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ChatController::messages
* @see app/Http/Controllers/ChatController.php:92
* @route '/projects/{project}/chat/messages'
*/
const messagesForm = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: messages.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ChatController::messages
* @see app/Http/Controllers/ChatController.php:92
* @route '/projects/{project}/chat/messages'
*/
messagesForm.get = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: messages.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ChatController::messages
* @see app/Http/Controllers/ChatController.php:92
* @route '/projects/{project}/chat/messages'
*/
messagesForm.head = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: messages.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

messages.form = messagesForm

/**
* @see \App\Http\Controllers\ChatController::clear
* @see app/Http/Controllers/ChatController.php:75
* @route '/projects/{project}/chat'
*/
export const clear = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: clear.url(args, options),
    method: 'delete',
})

clear.definition = {
    methods: ["delete"],
    url: '/projects/{project}/chat',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\ChatController::clear
* @see app/Http/Controllers/ChatController.php:75
* @route '/projects/{project}/chat'
*/
clear.url = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions) => {
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

    return clear.definition.url
            .replace('{project}', parsedArgs.project.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ChatController::clear
* @see app/Http/Controllers/ChatController.php:75
* @route '/projects/{project}/chat'
*/
clear.delete = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: clear.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\ChatController::clear
* @see app/Http/Controllers/ChatController.php:75
* @route '/projects/{project}/chat'
*/
const clearForm = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: clear.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ChatController::clear
* @see app/Http/Controllers/ChatController.php:75
* @route '/projects/{project}/chat'
*/
clearForm.delete = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: clear.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

clear.form = clearForm

const chat = {
    send: Object.assign(send, send),
    messages: Object.assign(messages, messages),
    clear: Object.assign(clear, clear),
}

export default chat