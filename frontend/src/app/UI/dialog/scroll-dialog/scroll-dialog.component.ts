import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material';

@Component({
    selector: 'scroll-dialog',
    templateUrl: './scroll-dialog.component.html',
    styleUrls: ['./scroll-dialog.component.css']
})
export class ScrollDialogComponent implements OnInit {

    constructor(public dialogRef: MatDialogRef<ScrollDialogComponent>,
                @Inject(MAT_DIALOG_DATA) public data: any) {
    }

    ngOnInit() {
    }

}
