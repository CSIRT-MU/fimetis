import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {FormControl, Validators} from '@angular/forms';


@Component({
    selector: 'app-add-cluster-definition',
    templateUrl: './add-cluster-definition.component.html',
    styleUrls: ['./add-cluster-definition.component.css']
})
export class AddClusterDefinitionComponent implements OnInit {

    constructor(public dialogRef: MatDialogRef<AddClusterDefinitionComponent>, @Inject(MAT_DIALOG_DATA) public data: any) { }

    name = '';
    description = '';
    definition = '';
    filter_name = '';

    ngOnInit() {
        console.log(this.data.filters);
    }

    updateName(name) {
      this.name = name;
    }

    updateDescription(description) {
      this.description = description;
    }

    updateDefinition(definition) {
      this.definition = definition;
    }

    onSaveClick() {
        this.dialogRef.close({
            'name': this.name,
            'definition': this.definition,
            'description': this.description,
            'filter_name': this.filter_name
        });
    }

    onCancelClick() {
        this.dialogRef.close(false);
    }
}
