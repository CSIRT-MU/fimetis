import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { UserProfile } from '../models/user-profile.model';
import {environment} from '../../environments/environment';
import { UserManager, UserManagerSettings, User } from 'oidc-client';
import { HTTPService } from '../services/http.service';


@Injectable({ providedIn: 'root' })
export class AuthenticationService {

    private NOT_AVAILABLE_STRING = 'not available';
    private currentUserSubject: BehaviorSubject<UserProfile>;
    public currentUser: Observable<UserProfile>;

    public oidcUser = null;

    private manager = new UserManager(getClientSettings());

    constructor(private http: HTTPService) {
        this.currentUserSubject = new BehaviorSubject<UserProfile>(JSON.parse(localStorage.getItem('currentUser')));
        this.currentUser = this.currentUserSubject.asObservable();
    }

    public get currentUserValue(): UserProfile {
        return this.currentUserSubject.value;
    }

    public getUserLogin(): string {
        return this.currentUserSubject.value.username;
    }

    public getUser() {
        return this.currentUserSubject.value;
    }


    login(username: string, password: string) {
        return this.http.post('/login', { username, password })
            .pipe(map(user => {
                // login successful if there's a jwt token in the response
                if (user && user.token) {
                    // store user details and jwt token in local storage to keep user logged in between page refreshes
                    localStorage.setItem('currentUser', JSON.stringify(user));
                    this.currentUserSubject.next(user);
                }

                return user;
            }));
    }

    logout() {
        this.reset();
        location.reload();
    }

    getOidcLogin(): string {
        if (this.oidcUser === null) {
            return this.NOT_AVAILABLE_STRING;
        }
        return this.oidcUser.profile['sub'];
    }

    getOidcName(): string {
        if (this.oidcUser === null) {
            return this.NOT_AVAILABLE_STRING;
        }

        return this.oidcUser.profile['name'];
    }

    getOidcPreferredUserName(): string {
        if (this.oidcUser === null) {
            return this.NOT_AVAILABLE_STRING;
        }
        return this.oidcUser.profile['preferred_username'];
    }

    getOidcEmail(): string {
        if (this.oidcUser === null) {
            return this.NOT_AVAILABLE_STRING;
        }
        return this.oidcUser.profile['email'];
    }

    getOidcGroups(): [] {
        if (this.oidcUser === null) {
            return [];
        }
        return this.oidcUser.profile['eduperson_entitlement'];
    }

    isAdmin() {
        let external_super_admin = false;
        const groups = this.getOidcGroups();
        for (let i = 0; i < groups.length; i++) {
            if (groups[i] == environment.oidc_admin_group_urn) {
                external_super_admin = true;
                break;
            }
        }
        return this.currentUserValue.is_super_admin || external_super_admin;
    }

    reset() {
        // remove user from local storage to log user out
        localStorage.removeItem('currentUser');
        this.currentUserSubject.next(null);
    }

    startAuthentication(): Promise<void> {
        return this.manager.signinRedirect();
    }

    completeAuthentication(): Promise<void> {
        const result = this.manager.signinRedirectCallback().then(user => {
            this.oidcUser = user;
            this.oidc_login().subscribe();
        })
        ;
        return result;
    }

    public oidc_login() {
        return this.http.post('/oidc-login', { 'access_token': this.oidcUser.access_token })
            .pipe(map(user => {
                // login successful if there's a jwt token in the response
                if (user && user.token) {
                    // store user details and jwt token in local storage to keep user logged in between page refreshes
                    localStorage.setItem('currentUser', JSON.stringify(user));
                    this.currentUserSubject.next(user);
                }

                return user;
            }));
    }

    getClaims(): any {
        return this.oidcUser.profile;
    }

    getAuthorizationHeaderValue(): string {
        return `${this.oidcUser.token_type} ${this.oidcUser.access_token}`;
    }


}
export function getClientSettings(): UserManagerSettings {
    return {
        authority: environment.oidc_authority,
        client_id: environment.oidc_client_id,
        client_secret: environment.oidc_client_secret,
        redirect_uri: environment.oidc_redirect_uri,
        post_logout_redirect_uri: environment.oidc_post_logout_redirect_uri,
        response_type: environment.oidc_response_type,
        scope: environment.oidc_scope,
        filterProtocolClaims: true,
        loadUserInfo: true
    };
}
