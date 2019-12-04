import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';


@Component({
    selector: 'app-mark-list-dialog',
    templateUrl: './mark-list-dialog.component.html',
    styleUrls: ['./mark-list-dialog.component.css']
})
export class MarkListDialogComponent implements OnInit {

    selected_marks = new Set<String>();
    constructor(public dialogRef: MatDialogRef<MarkListDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public data: any,
              ) {
    }

    ngOnInit() {
    }


    select(id) {
        if (this.selected_marks.has(id)) {
            this.selected_marks.delete(id);
        } else {
          this.selected_marks.add(id);
        }
    }

    onDeleteClick() {
      this.dialogRef.close(this.selected_marks);
    }
}
