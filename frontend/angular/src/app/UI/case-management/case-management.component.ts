import { Component, OnInit } from '@angular/core';
import {BaseService} from '../../services/base.service';
import {CaseService} from '../../services/case.service';
import {StateService} from '../../services/state.service';
import {AuthenticationService} from '../../auth/authentication.service';
import {ConfirmationDialogComponent} from '../dialog/confirmation-dialog/confirmation-dialog.component';
import {MatDialog} from '@angular/material/dialog';
import {SelectClustersComponent} from '../dialog/select-clusters/select-clusters.component';
import {SelectUsersComponent} from '../dialog/select-users/select-users.component';
import {SelectGroupsComponent} from '../dialog/select-groups/select-groups.component';

@Component({
    selector: 'app-case-management',
    templateUrl: './case-management.component.html',
    styleUrls: ['./case-management.component.css']
})
export class CaseManagementComponent implements OnInit {

    cases = [];
    users = [];
    groups = [];
    constructor(
        public dialog: MatDialog,
        private baseService: BaseService,
        private caseService: CaseService,
        private stateService: StateService,
        private authService: AuthenticationService
    ) { }

    ngOnInit() {
        this.loadAllCases();
        this.getAllUsers();
        this.getAllGroups();
    }

    loadAllCases() {
        this.cases = [];
        this.baseService.getAccessibleCases().then(
            response => {
                for (let i = 0; i < response.cases.length; i++ ) {
                    const tmpCase = {
                        'id': response.cases[i]['id'],
                        'name': response.cases[i]['name'],
                        'description': response.cases[i]['description'],
                        'created': response.cases[i]['created'],
                        'isAdmin': response.cases[i]['isAdmin']
                    };
                    this.cases.push(tmpCase);
                }
            }, error => {
                console.error(error);
            }).then(() => {
                console.log('Show Cases completed!');
            });
    }

    getTrFontWeightForCase(caseName) {
        if (this.caseService.selectedCase === caseName) {
            return 'bolder';
        }
        return 'normal';
    }

    removeSelectedCase(caseName) {
        const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
            width: '350px',
            data: {
                title: 'Are you sure ?',
                message: 'You want to delete whole dataset',
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.baseService.deleteCase(caseName).then(
                    response => {
                        console.log('Dataset deleted', response);
                        this.loadAllCases();
                    }, error => {
                        console.error(error);
                    }).then(() => {
                        console.log('Delete completed!');
                    });
            }
        });
    }

    getColorForSelectButton(caseName) {
        if (this.caseService.selectedCase === caseName) {
            return 'black';
        }
        return '#d9d9d9';
    }

    selectCase(caseName) {
        this.caseService.selectedCase = caseName;
    }

    updateCaseDescription(case_id, description) {
        this.baseService.updateCaseDescription(case_id, description).then(
            response => {
                this.loadAllCases();
            }, error => {
                console.error(error);
            }
        );
    }

    async selectAccess(access_type, case_id) {
        const currentUserIdsInArray = (await this.baseService.getUserIdsWithAccessToCase(case_id, access_type)).user_ids;
        const currentUserIds = new Set(currentUserIdsInArray);
        console.log(currentUserIds, currentUserIdsInArray);

        const dialogRef = this.dialog.open(SelectUsersComponent, {
            data: {
                type: access_type,
                curentUserIds: new Set(currentUserIds),
                allUsers: this.users
            },
            minWidth: '75%',

        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                const newUserIds = result;
                const newUserIdsInArray = Array.from(result);

                console.log(currentUserIds);
                console.log(newUserIds);

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
                this.baseService.manageAccessForManyUsersToCase(case_id, access_type, usersToAdd, usersToDel);
            }
        });
    }

    async selectGroups(case_id) {
        const currentGroupsIdsWithAccessCaseInArray = (await this.baseService.getGroupIdsWithAccessToCase(case_id)).group_ids;
        const currentGroupIds = new Set(currentGroupsIdsWithAccessCaseInArray);

        const dialogRef = this.dialog.open(SelectGroupsComponent, {
            data: {
                curentGroupIds: new Set(currentGroupIds),
                allGroups: this.groups
            },
            minWidth: '75%',

        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                const newGroupIds = result;
                const newGroupIdsInArray = Array.from(result);

                const groupsToAdd = [];

                for (let i = 0; i < newGroupIdsInArray.length; i++) {
                    if (!currentGroupIds.has(newGroupIdsInArray[i])) {
                        groupsToAdd.push(newGroupIdsInArray[i]);
                    }
                }

                const groupsToDel = [];

                for (let i = 0; i < currentGroupsIdsWithAccessCaseInArray.length; i++) {
                    if (!newGroupIds.has(currentGroupsIdsWithAccessCaseInArray[i])) {
                        groupsToDel.push(currentGroupsIdsWithAccessCaseInArray[i]);
                    }
                }
                this.baseService.manageAccessForManyGroupsToCase(case_id, groupsToAdd, groupsToDel);
            }
        });
    }

    async getAllUsers() {
        this.users = (await this.baseService.getAllUsers()).users;
    }

    async getAllGroups() {
        this.groups = (await this.baseService.getAllInternalGroups()).groups;
    }


}
