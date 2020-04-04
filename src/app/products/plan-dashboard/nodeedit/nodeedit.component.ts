import { Component, OnInit, Inject, AfterViewInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { NodeInterface, MilestoneNodeInterface, ActionNodeInterface, LinkPointNodeInterface } from '@shared/interfaces/node.interface';
import { FormGroup, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { NodeService } from '@shared/services/node.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { delay, map, catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { MilestoneEditComponent } from './milestoneedit/milestoneedit.component';
import { LinkpointEditComponent } from './linkpointedit/linkpointedit.component';
import { ActionNodeEditComponent } from './actionnodeedit/actionnodeedit.component';
import { ProductService } from '@shared/services/product.service';
import { ActionTypeInterface } from '@shared/interfaces/actiontype.interface';
import { environment } from '@environments/environment';

// This dialog mutates the data or adds data but does not
// Make database changes
// This dialog is for editing Tasks and Milestones,
// MilestoneLinks are edited in the MilestoneLinkEdit Component

export interface NodeEditDataInterface {
  node: NodeInterface;
  parentId: string;
}

@Component({
  selector: 'app-nodeedit',
  templateUrl: './nodeedit.component.html',
  styleUrls: ['./nodeedit.component.scss']
})
export class NodeEditDialogComponent implements OnInit, AfterViewInit {
  @ViewChild(MilestoneEditComponent) milestoneEditComponent: MilestoneEditComponent;
  @ViewChild(LinkpointEditComponent) linkpointEditComponent: LinkpointEditComponent;
  @ViewChild(ActionNodeEditComponent) actionNodeEditComponent: ActionNodeEditComponent;

  editTitle = 'Add New Milestone or Task';
  nodeForm: FormGroup;
  node: NodeInterface;
  action: ActionNodeInterface;
  milestone: MilestoneNodeInterface;
  linkPoint: LinkPointNodeInterface;
  nodeSelectList: NodeInterface[];
  // successors: NodeInterface[] = [];
  predecessors: NodeInterface[] = [];
  nodeLink: string;
  parentId: string;
  editMode = false;
  actionTypes: ActionTypeInterface[];
  nodeType = '';
  nodeTypes = ['Milestone', 'Action', 'LinkPoint'];
  milestoneTypes = ['Start', 'Infrastructure', 'API', 'Feature', 'Service', 'Product', 'Internal', 'External'];

  constructor(
    private ref: ChangeDetectorRef,
    private nodeService: NodeService,
    private productService: ProductService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<NodeEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: NodeEditDataInterface) { }

  ngOnInit(): void {

    this.initForm();
    this.editMode = this.data.node !== null;
    this.parentId = this.data.parentId;
    if (this.editMode) {
      this.node = this.data.node;
      this.nodeType = this.data.node.nodeType;
      if (this.data.node.nodeType === 'Milestone') {
        this.milestone = this.data.node as MilestoneNodeInterface;
      } else if (this.data.node.nodeType === 'LinkPoint') {
        this.linkPoint = this.data.node as LinkPointNodeInterface;
      } else {
        this.action = this.data.node as ActionNodeInterface;
      }
      this.editTitle = 'Editing ' + this.node.name;
    }
    this.nodeService.nodeLookup
      .pipe(
        switchMap(data => {
          if (data.length) {
            // Take the current node out of the selectlist for predecessors and successors
            // and timertrigger
            this.nodeSelectList = data;
            if (this.editMode) {
              const idx = this.nodeSelectList.findIndex(x => x.name === this.node.name);
              this.nodeSelectList.splice(idx, 1);
            }
          }
          return this.productService.getActionTypesHttp();
        }))
        .subscribe(actionTypes => {
          this.actionTypes = actionTypes;
          this.patchForm();
        },
        error => {
          if (!environment.production) {
            console.log('got error getting data' + error);
          }
        });
  }

  ngAfterViewInit() {
    if (this.nodeType === 'Milestone') {
      this.milestoneEditComponent.initForm();
      if (this.editMode) {
        this.milestoneEditComponent.patchForm();
      }
    } else if (this.nodeType === 'LinkPoint') {
      this.linkpointEditComponent.initForm();
      if (this.editMode) {
        this.linkpointEditComponent.patchForm();
      }
    } else if (this.nodeType === 'Action') {
      this.actionNodeEditComponent.initForm();
      if (this.editMode) {
        this.actionNodeEditComponent.patchForm();
      }
    }
    this.ref.detectChanges();
  }

  comparer(o1: any, o2: any): boolean {
    // if possible compare by object's name property - and not by reference.
    return o1 && o2 ? o1.id === o2.id : o2 === o2;
  }

  initForm() {
    this.nodeForm = new FormGroup({
      name: new FormControl(
        '',
        { validators: [Validators.required],
          asyncValidators: [this.validateNameAvailability.bind(this)],
          updateOn: 'blur' }),
      description: new FormControl('', [Validators.required, Validators.minLength(2)]),
      nodeType: new FormControl(this.nodeTypes[0]),
      timerDurationMinutes: new FormControl(0),
      timerTrigger: new FormControl(''),
      predecessors: new FormControl(''),
    });
    if (!this.editMode) {
      this.nodeType = 'Milestone';
      this.nodeForm.get('nodeType').setValidators(Validators.required);
    }
  }

  patchForm() {
    this.predecessors = this.nodeService.getPredecessors(this.node);
    const currentTimerTrigger = this.nodeService.getNodeById(this.node.timerTrigger);
    this.nodeType = this.node.nodeType;
    this.nodeForm.get('name').disable();
    this.nodeForm.get('nodeType').disable();
    this.nodeForm.patchValue({
      name: this.node.name,
      description: this.node.description,
      nodeType: this.node.nodeType,
      timerDurationMinutes: this.node.timerDurationMinutes,
      timerTrigger: currentTimerTrigger
    });
    if (this.predecessors.length) {
      this.nodeForm.patchValue({
        predecessors: this.predecessors
      });
    }
  }

  validateNameAvailability(ctrl: AbstractControl): Promise<ValidationErrors | null> | Observable<ValidationErrors | null> {
    return this.nodeService.isNameTaken(ctrl.value).pipe(
      map(isTaken => (isTaken ? { nameTaken: true } : null)),
      catchError(() => of(null))
    );
  }

  onNameChanges(): void {
    this.nodeForm.get('name').valueChanges.pipe
      (debounceTime(300),
        distinctUntilChanged()).
      subscribe(val => {
        this.nodeForm.patchValue({
          name: val.toUpperCase()
        });
      });
  }

  onNodeTypeChanges(): void {
    // This is only possible on !editMode
    this.nodeForm.get('nodeType').valueChanges
      .subscribe(val => {
        this.nodeType = val;
      });
  }

  onSubmit() {
    if (this.nodeForm.invalid) {
      this.snackBar.open('Please fill in required fields', '', {
        duration: 2000,
      });
      return;
    }

    let nodeId = '';
    let timerTriggerId = '';
    if (this.nodeForm.value.timerTrigger) {
      timerTriggerId = this.nodeForm.value.timerTrigger.id;
    }
    if (!this.editMode) {
      nodeId = this.parentId + '!';
      if (this.nodeType === 'Action') {
        nodeId = nodeId + 'a.' + this.nodeForm.value.name;
      } else if (this.nodeType === 'Milestone') {
        nodeId = nodeId + 'm.' + this.nodeForm.value.name;
      } else if (this.nodeType === 'Linkpoint') {
        nodeId = nodeId + 'l.' + this.nodeForm.value.name;
      }
    } else {
      nodeId = this.node.id;
    }

    let selectPredecessors = [];
    if (this.nodeType !== 'LinkPoint') {
      if ((this.nodeForm.value.predecessors) && (this.nodeForm.value.predecessors.length)) {
        selectPredecessors = this.nodeForm.value.predecessors.map(x => {
          return x.id;
        });
      }
    }

    if (this.nodeType === 'Milestone') {
      this.dialogRef.close(this.createMilestoneNode(nodeId, selectPredecessors, timerTriggerId));
    } else if (this.nodeType === 'Action') {
      this.dialogRef.close(this.createActionNode(nodeId, selectPredecessors, timerTriggerId));
    } else if (this.nodeType === 'LinkPoint') {
      this.dialogRef.close(this.createLinkPointNode(nodeId, selectPredecessors, timerTriggerId));
    }

  }

  createActionNode(nodeId: string, selectPredecessors: string[], timerTriggerId: string) {
    const actionNode: ActionNodeInterface = {
      id: nodeId,
      parentId: this.parentId,
      name: (this.editMode) ? this.node.name : this.nodeForm.value.name.toUpperCase(),
      description: this.nodeForm.value.description,
      selfLink: (this.editMode) ? this.node.selfLink : '',
      nodeType: 'Action',
      predecessors: selectPredecessors,
      timerDurationMinutes: this.nodeForm.value.timerDurationMinutes,
      timerTrigger: timerTriggerId,
      actionTypeId: this.nodeForm.get('actionNodeForm').value.actionType,
      actionData: this.nodeForm.value.actionData,
      inputs: null,
      expectedDurationMinutes: this.nodeForm.value.expectedDurationMinutes
    };
    return actionNode;
  }

  createMilestoneNode(nodeId: string, selectPredecessors: string[], timerTriggerId: string) {
    const milestone: MilestoneNodeInterface = {
      id: nodeId,
      parentId:  this.parentId,
      name: (this.editMode) ? this.node.name : this.nodeForm.value.name.toUpperCase(),
      description: this.nodeForm.value.description,
      selfLink: (this.editMode) ? this.node.selfLink : '',
      nodeType: 'Milestone',
      predecessors: selectPredecessors,
      timerDurationMinutes: this.nodeForm.value.timerDurationMinutes,
      timerTrigger: timerTriggerId,
      milestoneType: this.nodeForm.get('milestoneForm').value.milestoneType,
      label: this.nodeForm.get('milestoneForm').value.label,
      stateAnnounced: this.nodeForm.get('milestoneForm').value.stateAnnounced,
      spanningPredecessors: (this.editMode) ? this.milestone.spanningPredecessors : []
      };
    return milestone;
  }

  createLinkPointNode(nodeId: string, selectPredecessors: string[], timerTriggerId: string) {
    const linkPointNode = this.nodeForm.get('linkPointForm').value.linkedMilestoneSelect;
    const linkPoint: LinkPointNodeInterface = {
      id: nodeId,
      parentId: this.parentId,
      name: (this.editMode) ? this.node.name : this.nodeForm.value.name.toUpperCase(),
      description: this.nodeForm.value.description,
      selfLink: (this.editMode) ? this.node.selfLink : '',
      nodeType: 'LinkPoint',
      predecessors: selectPredecessors,
      timerDurationMinutes: this.nodeForm.value.timerDurationMinutes,
      timerTrigger: timerTriggerId,
      linkedId: linkPointNode.linkedId,
      linkedMilestoneType: linkPointNode.linkedMilestoneType,
      linkedLabel: linkPointNode.linkedLabel,
      linkedStateAnnounced: linkPointNode.linkedStateAnnounced
    };
    return linkPoint;
  }

  onClose(): void {
      this.dialogRef.close();
  }

}
