import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {FormControl, Validators} from '@angular/forms';


@Component({
    selector: 'app-add-cluster-definition',
    templateUrl: './add-cluster-definition.component.html',
    styleUrls: ['./add-cluster-definition.component.css']
})
export class AddClusterDefinitionComponent implements OnInit {

    constructor(
        public dialogRef: MatDialogRef<AddClusterDefinitionComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) { }

    name = '';
    description = '';
    definition = '';
    filter_name = '';

    nameValidators = [Validators.required, Validators.minLength(3)];
    definitionValidators = [Validators.required, Validators.minLength(1)];

    isNameValid = new FormControl(this.name, this.nameValidators);
    isDefinitionValid = new FormControl(this.definition, this.definitionValidators);


    ngOnInit() {
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
        if (!this.isNameUnique()) {
            return false;
        }
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

    isNameUnique() {
        for (let i = 0; i < this.data.clusters.length; i++) {
            if (this.name === this.data.clusters[i].name) {
                return false;
            }
        }
        return true;
    }
}
