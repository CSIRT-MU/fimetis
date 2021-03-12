import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';

@Component({
  selector: 'app-select-users',
  templateUrl: './select-users.component.html',
  styleUrls: ['./select-users.component.css']
})
export class SelectUsersComponent implements OnInit {

  constructor(public dialogRef: MatDialogRef<SelectUsersComponent>, @Inject(MAT_DIALOG_DATA) public data: any) { }

  ids = new Set();

  ngOnInit() {
  }

  onSaveClick() {
    this.dialogRef.close(this.data.curentUserIds);

  }

  onCancelClick() {
    this.dialogRef.close(false);
  }

  onChecked(id) {
    console.log('checking');
    if (this.data.curentUserIds.has(id)) {
      this.data.curentUserIds.delete(id);
    } else {
      this.data.curentUserIds.add(id);
    }

  }

}
