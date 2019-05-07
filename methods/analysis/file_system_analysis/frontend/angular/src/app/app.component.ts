import {Component} from '@angular/core';
import {User} from './models/user.model';
import {AuthenticationService} from './auth/authentication.service';
import {Router} from '@angular/router';
import {UserSettingsService} from './services/userSettings.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent {
    title = 'TIMESIX 2.0';
    description = 'Angular Frontend';
    currentUser: User;
    advancedMode = false;

    constructor(
        private router: Router,
        private authenticationService: AuthenticationService,
        private userSettingsService: UserSettingsService
    ) {
        this.authenticationService.currentUser.subscribe(x => this.currentUser = x);
        this.advancedMode = userSettingsService.advancedMode.getValue();
        this.userSettingsService.advancedMode.subscribe(mode => {this.advancedMode = mode; });
    }

    setAdvancedMode(mode: boolean) {
        this.userSettingsService.setAdvancedMode(mode);
    }

    getRouter() {
        return this.router;
    }

    /**
     * Logout current user
     */
    logout() {
        this.authenticationService.logout();
        // this.router.navigate(['/login']);
    }
}
