// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
    production: false,
    backendUrl: 'http://127.0.0.1:5000',
    oidc_enabled: 'true',
    oidc_authority: 'https://oidc.muni.cz/oidc/',
    oidc_client_id: 'client-id',
    oidc_client_secret: 'XXXXXXX',
    oidc_redirect_uri: 'http://localhost:4200/auth-callback',
    oidc_post_logout_redirect_uri: 'http://localhost:4200/auth-callback',
    oidc_scope: 'openid profile email eduperson_entitlement',
    oidc_response_type: 'id_token token',
    oidc_admin_group_urn: 'urn:geant:muni.cz:res:handlingCSIRTMU#idm.ics.muni.cz',
    oidc_user_group_urn: 'urn:geant:muni.cz:res:CSIRT-MU#idm.ics.muni.cz'
};

/*
 * In development mode, to ignore zone related error stack frames such as
 * `zone.run`, `zoneDelegate.invokeTask` for easier debugging, you can
 * import the following file, but please comment it out in production mode
 * because it will have performance impact when throw error
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
