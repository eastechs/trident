export const open = () => ({
  url: '/documentation/open',
  method: 'post' as const,
});

open.url = () => '/documentation/open';
open.post = () => ({ url: '/documentation/open', method: 'post' as const });

const DocumentationController = { open };
export default DocumentationController;
