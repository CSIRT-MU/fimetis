import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AddClusterDefinitionComponent } from './add-cluster-definition.component';

describe('AddClusterDefinitionComponent', () => {
  let component: AddClusterDefinitionComponent;
  let fixture: ComponentFixture<AddClusterDefinitionComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AddClusterDefinitionComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AddClusterDefinitionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
