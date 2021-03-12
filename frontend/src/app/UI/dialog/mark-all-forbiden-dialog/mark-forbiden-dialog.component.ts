import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material';

@Component({
    selector: 'mark-forbiden-dialog',
    templateUrl: './mark-forbiden-dialog.component.html',
    styleUrls: ['./mark-forbiden-dialog.component.css']
})
export class MarkForbidenDialogComponent implements OnInit {

    constructor(public dialogRef: MatDialogRef<MarkForbidenDialogComponent>,
                @Inject(MAT_DIALOG_DATA) public data: any) {
    }

    ngOnInit() {
    }

}
