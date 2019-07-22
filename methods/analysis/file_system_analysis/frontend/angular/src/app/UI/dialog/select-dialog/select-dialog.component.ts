import {Component, Inject, OnInit, ViewChild} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef, MatSelectionList} from '@angular/material';

@Component({
    selector: 'app-select-dialog',
    templateUrl: './select-dialog.component.html',
    styleUrls: ['./select-dialog.component.css']
})
export class SelectDialogComponent implements OnInit {

    @ViewChild(MatSelectionList, {static: false})
    list: MatSelectionList;

    constructor(public dialogRef: MatDialogRef<SelectDialogComponent>,
                @Inject(MAT_DIALOG_DATA) public data: any) {
    }

    ngOnInit() {
    }

    onCancelClick() {
        this.dialogRef.close(null);
    }

    onOkClick() {
        const result = [];
        for (const option of this.list.selectedOptions.selected) {
            result.push(option.getLabel().replace(new RegExp(' ', 'g'), ''));
        }
        console.log(result);
        this.dialogRef.close(result);
    }

}
