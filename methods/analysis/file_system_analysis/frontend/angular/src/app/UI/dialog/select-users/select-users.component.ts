import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {SelectClustersComponent} from '../select-clusters/select-clusters.component';

@Component({
  selector: 'app-select-users',
  templateUrl: './select-users.component.html',
  styleUrls: ['./select-users.component.css']
})
export class SelectUsersComponent implements OnInit {

  constructor(public dialogRef: MatDialogRef<SelectClustersComponent>, @Inject(MAT_DIALOG_DATA) public data: any) { }

  ids = new Set();

  ngOnInit() {
  }

  onSaveClick() {
    this.dialogRef.close(this.ids);

  }

  onCancelClick() {
    this.dialogRef.close(false);
  }

  onChecked(id) {
    if (this.ids.has(id)) {
      this.ids.delete(id);
    } else {
      this.ids.add(id);
    }

  }

}
