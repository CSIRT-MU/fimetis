import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';

@Component({
  selector: 'app-select-clusters',
  templateUrl: './select-clusters.component.html',
  styleUrls: ['./select-clusters.component.css']
})
export class SelectClustersComponent implements OnInit {

  test;
  constructor(public dialogRef: MatDialogRef<SelectClustersComponent>, @Inject(MAT_DIALOG_DATA) public data: any) { }

  ngOnInit() {
  }

  onSaveClick() {
      this.dialogRef.close(this.data.currentClustersIds);

  }

  onCancelClick() {
    this.dialogRef.close(false);
  }

  onChecked(id) {
    if (this.data.currentClustersIds.has(id)) {
      this.data.currentClustersIds.delete(id);
    } else {
      this.data.currentClustersIds.add(id);
    }

  }

}
