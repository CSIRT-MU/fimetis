import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ComputationDialogComponent } from './computation-dialog.component';

describe('ComputationDialogComponent', () => {
  let component: ComputationDialogComponent;
  let fixture: ComponentFixture<ComputationDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ComputationDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ComputationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
