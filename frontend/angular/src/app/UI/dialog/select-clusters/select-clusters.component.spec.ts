import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectClustersComponent } from './select-clusters.component';

describe('SelectClustersComponent', () => {
  let component: SelectClustersComponent;
  let fixture: ComponentFixture<SelectClustersComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SelectClustersComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectClustersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
