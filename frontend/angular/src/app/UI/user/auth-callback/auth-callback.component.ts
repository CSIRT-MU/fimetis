import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from '../../../auth/authentication.service';


@Component({
    selector: 'app-auth-callback',
    templateUrl: './auth-callback.component.html',
    styleUrls: ['./auth-callback.component.css']
})

export class AuthCallbackComponent implements OnInit {

    constructor(public authenticationService: AuthenticationService) {
    }

    ngOnInit() {
        this.authenticationService.completeAuthentication();
    }

}
