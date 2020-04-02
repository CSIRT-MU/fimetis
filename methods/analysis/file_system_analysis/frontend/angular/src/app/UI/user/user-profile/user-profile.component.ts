import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from '../../../auth/authentication.service';
import { UserProfile } from '../../../models/user-profile.model';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit {

    constructor(public authenticationService: AuthenticationService) {
    }

    user: UserProfile;
    ngOnInit() {
        this.user = this.authenticationService.getUser();
        console.log(this.user);
    }

}
