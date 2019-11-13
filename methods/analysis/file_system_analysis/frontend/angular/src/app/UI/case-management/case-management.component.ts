import { Component, OnInit } from '@angular/core';
import {BaseService} from '../../services/base.service';
import {CaseService} from '../../services/case.service';
import {StateService} from '../../services/state.service';
import {AuthenticationService} from '../../auth/authentication.service';
import {ConfirmationDialogComponent} from '../dialog/confirmation-dialog/confirmation-dialog.component';
import {MatDialog} from '@angular/material/dialog';

@Component({
    selector: 'app-case-management',
    templateUrl: './case-management.component.html',
    styleUrls: ['./case-management.component.css']
})
export class CaseManagementComponent implements OnInit {

    cases: Set<string> = new Set<string>();
    constructor(
        public dialog: MatDialog,
        private baseService: BaseService,
        private caseService: CaseService,
        private stateService: StateService,
        private authService: AuthenticationService
    ) { }

    ngOnInit() {
        this.loadAllCases();
    }

    loadAllCases() {
        this.cases = new Set<string>();
        this.baseService.getAccessibleCases().then(
            response => {
                for (let i = 0; i < response.cases.length; i++ ) {
                    this.cases.add(response.cases[i]);
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

}
