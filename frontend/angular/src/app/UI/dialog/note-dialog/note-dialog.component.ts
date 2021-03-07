import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';

@Component({
    selector: 'app-note-dialog',
    templateUrl: './note-dialog.component.html',
    styleUrls: ['./note-dialog.component.css']
})
export class NoteDialogComponent implements OnInit {

    constructor(public dialogRef: MatDialogRef<NoteDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) { }

    ngOnInit() {
    }


    onSaveClick() {
        this.dialogRef.close(this.data.note);
    }

    onCancelClick() {
        this.dialogRef.close(false);
    }

    update(param) {
        this.data.note = param;
    }

}
