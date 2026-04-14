import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../wayfinder'
/**
* @see \App\Http\Controllers\ImageController::index
* @see app/Http/Controllers/ImageController.php:16
* @route '/projects/{project}/images'
*/
export const index = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(args, options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/projects/{project}/images',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ImageController::index
* @see app/Http/Controllers/ImageController.php:16
* @route '/projects/{project}/images'
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
* @see \App\Http\Controllers\ImageController::index
* @see app/Http/Controllers/ImageController.php:16
* @route '/projects/{project}/images'
*/
index.get = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ImageController::index
* @see app/Http/Controllers/ImageController.php:16
* @route '/projects/{project}/images'
*/
index.head = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ImageController::index
* @see app/Http/Controllers/ImageController.php:16
* @route '/projects/{project}/images'
*/
const indexForm = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ImageController::index
* @see app/Http/Controllers/ImageController.php:16
* @route '/projects/{project}/images'
*/
indexForm.get = (args: { project: string | { id: string } } | [project: string | { id: string } ] | string | { id: string }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ImageController::index
* @see app/Http/Controllers/ImageController.php:16
* @route '/projects/{project}/images'
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
* @see \App\Http\Controllers\ImageController::show
* @see app/Http/Controllers/ImageController.php:25
* @route '/projects/{project}/images/{image}'
*/
export const show = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/projects/{project}/images/{image}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ImageController::show
* @see app/Http/Controllers/ImageController.php:25
* @route '/projects/{project}/images/{image}'
*/
show.url = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            project: args[0],
            image: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        project: typeof args.project === 'object'
        ? args.project.id
        : args.project,
        image: typeof args.image === 'object'
        ? args.image.id
        : args.image,
    }

    return show.definition.url
            .replace('{project}', parsedArgs.project.toString())
            .replace('{image}', parsedArgs.image.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ImageController::show
* @see app/Http/Controllers/ImageController.php:25
* @route '/projects/{project}/images/{image}'
*/
show.get = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ImageController::show
* @see app/Http/Controllers/ImageController.php:25
* @route '/projects/{project}/images/{image}'
*/
show.head = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ImageController::show
* @see app/Http/Controllers/ImageController.php:25
* @route '/projects/{project}/images/{image}'
*/
const showForm = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ImageController::show
* @see app/Http/Controllers/ImageController.php:25
* @route '/projects/{project}/images/{image}'
*/
showForm.get = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ImageController::show
* @see app/Http/Controllers/ImageController.php:25
* @route '/projects/{project}/images/{image}'
*/
showForm.head = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
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
* @see \App\Http\Controllers\ImageController::update
* @see app/Http/Controllers/ImageController.php:43
* @route '/projects/{project}/images/{image}'
*/
export const update = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/projects/{project}/images/{image}',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\ImageController::update
* @see app/Http/Controllers/ImageController.php:43
* @route '/projects/{project}/images/{image}'
*/
update.url = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            project: args[0],
            image: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        project: typeof args.project === 'object'
        ? args.project.id
        : args.project,
        image: typeof args.image === 'object'
        ? args.image.id
        : args.image,
    }

    return update.definition.url
            .replace('{project}', parsedArgs.project.toString())
            .replace('{image}', parsedArgs.image.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ImageController::update
* @see app/Http/Controllers/ImageController.php:43
* @route '/projects/{project}/images/{image}'
*/
update.patch = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\ImageController::update
* @see app/Http/Controllers/ImageController.php:43
* @route '/projects/{project}/images/{image}'
*/
const updateForm = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ImageController::update
* @see app/Http/Controllers/ImageController.php:43
* @route '/projects/{project}/images/{image}'
*/
updateForm.patch = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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
* @see \App\Http\Controllers\ImageController::destroy
* @see app/Http/Controllers/ImageController.php:66
* @route '/projects/{project}/images/{image}'
*/
export const destroy = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/projects/{project}/images/{image}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\ImageController::destroy
* @see app/Http/Controllers/ImageController.php:66
* @route '/projects/{project}/images/{image}'
*/
destroy.url = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            project: args[0],
            image: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        project: typeof args.project === 'object'
        ? args.project.id
        : args.project,
        image: typeof args.image === 'object'
        ? args.image.id
        : args.image,
    }

    return destroy.definition.url
            .replace('{project}', parsedArgs.project.toString())
            .replace('{image}', parsedArgs.image.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ImageController::destroy
* @see app/Http/Controllers/ImageController.php:66
* @route '/projects/{project}/images/{image}'
*/
destroy.delete = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\ImageController::destroy
* @see app/Http/Controllers/ImageController.php:66
* @route '/projects/{project}/images/{image}'
*/
const destroyForm = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ImageController::destroy
* @see app/Http/Controllers/ImageController.php:66
* @route '/projects/{project}/images/{image}'
*/
destroyForm.delete = (args: { project: string | { id: string }, image: string | number | { id: string | number } } | [project: string | { id: string }, image: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const images = {
    index: Object.assign(index, index),
    show: Object.assign(show, show),
    update: Object.assign(update, update),
    destroy: Object.assign(destroy, destroy),
}

export default images