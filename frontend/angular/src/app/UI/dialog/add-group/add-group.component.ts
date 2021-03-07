import { Component, Inject, OnInit } from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {FormControl, Validators} from '@angular/forms';

@Component({
    selector: 'app-add-group',
    templateUrl: './add-group.component.html',
    styleUrls: ['./add-group.component.css']
})
export class AddGroupComponent implements OnInit {

    constructor(
        public dialogRef: MatDialogRef<AddGroupComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
    }

    name = '';
    role = '';

    nameValidators = [Validators.required, Validators.minLength(3)];

    isNameValid = new FormControl('', this.nameValidators);

    ngOnInit() {
    }

    updateName(name) {
        this.name = name;
    }

    onSaveClick() {
        if (!this.isNameUnique()) {
            return false;
        }
        this.dialogRef.close({
          'name': this.name,
          'role': this.role
        });
    }

    isNameUnique() {
        for (let i = 0; i < this.data.groups.length; i++) {
            if (this.name === this.data.groups[i].name) {
                return false;
            }
        }
        return true;
    }

    onCancelClick() {
      this.dialogRef.close(false);
    }
}
