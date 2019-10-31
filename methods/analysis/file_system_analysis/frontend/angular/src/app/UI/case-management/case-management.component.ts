import { Component, OnInit } from '@angular/core';
import {ClusterService} from '../../services/cluster.service';
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

  cases: Map<string, number> = new Map<string, number>();
  constructor(
      public dialog: MatDialog,
      private baseService: BaseService,
      private caseService: CaseService,
      private stateService: StateService,
      private authService: AuthenticationService
  ) { }

  ngOnInit() {
    this.loadAllCases();
    console.log(this.cases);

  }

  loadAllCases() {
    this.baseService.getCases().then(
        response => {
            for (let i = 0; i < response.cases.length; i++ ) {
                this.cases.set(response.cases[i].key, response.cases[i].doc_count);
                console.log(this.cases);


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
                  }, error => {
                      console.error(error);
                  }).then(() => {
                  console.log('Delete completed!');
              });
              if (caseName === this.caseService.selectedCase) {
                  this.caseService.selectedCase = null;
              }
              this.cases.delete(caseName);
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
