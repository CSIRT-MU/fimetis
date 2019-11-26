import { Component, OnInit } from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {BaseService} from '../../services/base.service';
import {CaseService} from '../../services/case.service';
import {StateService} from '../../services/state.service';
import {AuthenticationService} from '../../auth/authentication.service';
import {ConfirmationDialogComponent} from '../dialog/confirmation-dialog/confirmation-dialog.component';

@Component({
    selector: 'app-access-management',
    templateUrl: './access-management.component.html',
    styleUrls: ['./access-management.component.css']
})
export class AccessManagementComponent implements OnInit {

    cases = [];
    constructor(
        public dialog: MatDialog,
        private baseService: BaseService,
        private caseService: CaseService,
        private stateService: StateService,
        private authService: AuthenticationService
    ) { }

    caseIdToEdit = null;
    selectedUserToAdd: string;
    userAddFormVisible: boolean;
    adminAddFormVisible: boolean;
    availableUsers = [];

    ngOnInit() {
        this.loadAllCases();
    }

    loadAllCases() {
        this.cases = [];
        this.baseService.getAdministratedCases().then(
            response => {
                for (let i = 0; i < response.cases.length; i++ ) {
                    const tmpCase = {
                        'id': response.cases[i]['id'],
                        'name': response.cases[i]['name'],
                        'description': response.cases[i]['description'],
                        'created': response.cases[i]['created'],
                        'admins': response.cases[i]['admins'],
                        'users': response.cases[i]['users']
                    };
                    this.cases.push(tmpCase);
                }
            }, error => {
                console.error(error);
            }).then(() => {
                console.log('Show Cases completed!');
            });
    }


    displayUserAddForm(id) {
        this.userAddFormVisible = true;
        this.adminAddFormVisible = false;
        this.caseIdToEdit = id;
    }

    displayAdminAddForm(id) {
        this.adminAddFormVisible = true;
        this.userAddFormVisible = false;
        this.caseIdToEdit = id;
    }

    getAvailableUsersToAdd(case_id) {
        this.availableUsers = [];
            this.baseService.getAvailableUsersToAdd(case_id).then(
                response => {
                    for (let i = 0; i < response.cases.length; i++ ) {
                        this.availableUsers.push(response.cases[i]);
                    }
                }, error => {
                    console.error(error);
                });
    }

    addUserAccessToCase(case_id, role) {
        // console.log(this.selectedUser);
        this.baseService.addUserAccessToCase(case_id, this.selectedUserToAdd, role).then(
            response => {
                this.userAddFormVisible = false;
                this.loadAllCases();
            }, error => {
                console.error(error);
            }
        );
    }

    addAdminAccessToCase(case_id, role) {
        this.baseService.addUserAccessToCase(case_id, this.selectedUserToAdd, role).then(
            response => {
                this.adminAddFormVisible = false;
                this.loadAllCases();
            }, error => {
                console.error(error);
            }
        );
    }

    deleteAccessToCase(case_id, login) {
        const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
            width: '350px',
            data: {
                title: 'Are you sure ?',
                message: 'You want to delete access of ' + login + ' to this case',
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.baseService.deleteUserAccessToCase(case_id, login).then(
                    response => {
                        this.loadAllCases();
                    }, error => {
                        console.error(error);
                    }
                );
            }
        });
    }


    isAdmin() {
        return this.authService.isAdmin();
    }

}
