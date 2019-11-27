import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MarkListDialogComponent } from './mark-list-dialog.component';

describe('MarkListDialogComponent', () => {
  let component: MarkListDialogComponent;
  let fixture: ComponentFixture<MarkListDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MarkListDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MarkListDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
