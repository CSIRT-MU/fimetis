import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ClusterManagementComponent } from './cluster-management.component';

describe('ClusterManagementComponent', () => {
  let component: ClusterManagementComponent;
  let fixture: ComponentFixture<ClusterManagementComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ClusterManagementComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ClusterManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
