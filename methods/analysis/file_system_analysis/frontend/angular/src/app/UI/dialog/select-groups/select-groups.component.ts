import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';

@Component({
  selector: 'app-select-groups',
  templateUrl: './select-groups.component.html',
  styleUrls: ['./select-groups.component.css']
})
export class SelectGroupsComponent implements OnInit {

  constructor(public dialogRef: MatDialogRef<SelectGroupsComponent>, @Inject(MAT_DIALOG_DATA) public data: any) { }

  ids = new Set();

  ngOnInit() {

  }

  onSaveClick() {
    this.dialogRef.close(this.data.curentGroupIds);

  }

  onCancelClick() {
    this.dialogRef.close(false);
  }

  onChecked(id) {
    console.log('checking');
    if (this.data.curentGroupIds.has(id)) {
      this.data.curentGroupIds.delete(id);
    } else {
      this.data.curentGroupIds.add(id);
    }

  }

}
