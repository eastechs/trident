export const setProjectTourCompleted = () => ({
  url: '/api/settings/project-tour',
  method: 'put' as const,
});

setProjectTourCompleted.url = () => '/api/settings/project-tour';
setProjectTourCompleted.put = () => ({ url: '/api/settings/project-tour', method: 'put' as const });

const SettingsController = { setProjectTourCompleted };
export default SettingsController;
