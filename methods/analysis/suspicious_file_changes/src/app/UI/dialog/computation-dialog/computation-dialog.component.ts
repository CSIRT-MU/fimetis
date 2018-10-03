import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material';

@Component({
  selector: 'app-computation-dialog',
  templateUrl: './computation-dialog.component.html',
  styleUrls: ['./computation-dialog.component.css']
})
export class ComputationDialogComponent implements OnInit {

  resultName = '';
  resultColor = '';

  constructor(public dialogRef: MatDialogRef<ComputationDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public data: any) { }

  ngOnInit() {
  }

  onCancelClick() {
    this.dialogRef.close(null);
  }

  onOkClick() {
    this.dialogRef.close([this.resultName, this.resultColor]);
  }

}
