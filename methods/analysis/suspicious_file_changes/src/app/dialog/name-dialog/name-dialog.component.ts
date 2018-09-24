import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material';

@Component({
  selector: 'app-name-dialog',
  templateUrl: './name-dialog.component.html',
  styleUrls: ['./name-dialog.component.css']
})
export class NameDialogComponent implements OnInit {

  resultName = '';

  constructor(public dialogRef: MatDialogRef<NameDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public data: any) { }

  ngOnInit() {
  }

  onCancelClick() {
    this.dialogRef.close(null);
  }

  onOkClick() {
    this.dialogRef.close(this.resultName);
  }

}
