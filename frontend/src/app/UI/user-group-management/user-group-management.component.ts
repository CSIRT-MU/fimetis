import { Component, OnInit } from '@angular/core';
import {BaseService} from '../../services/base.service';
import {MatDialog} from '@angular/material/dialog';
import {SelectUsersComponent} from '../dialog/select-users/select-users.component';
import {AddUserComponent} from '../dialog/add-user/add-user.component';
import {AddGroupComponent} from '../dialog/add-group/add-group.component';
import {AuthenticationService} from '../../auth/authentication.service';

@Component({
   selector: 'app-user-group-management',
   templateUrl: './user-group-management.component.html',
   styleUrls: ['./user-group-management.component.css']
})

export class UserGroupManagementComponent implements OnInit {
    groups = [];
    users = [];

    constructor(
        private baseService: BaseService,
        public authenticationService: AuthenticationService,
        public dialog: MatDialog
    ) {

    }

    ngOnInit() {
        this.getAllGroups();
        this.getAllUsers();
    }

    async getAllUsers() {
        this.users = (await this.baseService.getAllUsers()).users;
    }

    async getAllGroups() {
        this.groups = (await this.baseService.getAllGroups()).groups;
    }

    async manageUsers(group_id) {
        const currentUserIdsInArray = (await this.baseService.getUsersInGroup(group_id)).user_ids;
        const currentUserIds = new Set(currentUserIdsInArray);

        const dialogRef = this.dialog.open(SelectUsersComponent, {
            data: {
                curentUserIds: new Set(currentUserIds),
                allUsers: this.users
            },
            minWidth: '75%',
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                const newUserIds = result;
                const newUserIdsInArray = Array.from(result);

                const usersToAdd = [];

                for (let i = 0; i < newUserIdsInArray.length; i++) {
                    if (!currentUserIds.has(newUserIdsInArray[i])) {
                        usersToAdd.push(newUserIdsInArray[i]);
                    }
                }

                const usersToDel = [];

                for (let i = 0; i < currentUserIdsInArray.length; i++) {
                    if (!newUserIds.has(currentUserIdsInArray[i])) {
                        usersToDel.push(currentUserIdsInArray[i]);
                    }
                }

                this.baseService.manageUsersInGroup(group_id, usersToAdd, usersToDel).then(
                    response => {
                        console.log(this.users);
                        this.getAllUsers();
                    });
            }
        });
    }

    addUser() {
        const dialogRef = this.dialog.open(AddUserComponent, {
            minWidth: '75%',
            minHeight: '70%',
            data: {
                title: 'Add new user',
                users: this.users
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.baseService.addUser(result['login'], result['password'], result['name'], result['email']).then(
                    response => {
                        this.getAllUsers();
                    }, error => {
                        console.error(error);
                    });
            }

        });
    }

    addGroup() {
        const dialogRef = this.dialog.open(AddGroupComponent, {
            minWidth: '75%',
            minHeight: '70%',
            data: {
                title: 'Add new group',
                groups: this.groups
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.baseService.addGroup(result['name'], result['role']).then(
                    response => {
                        this.getAllGroups();
                    }, error => {
                        console.error(error);
                    });
            }
        });
    }
}
