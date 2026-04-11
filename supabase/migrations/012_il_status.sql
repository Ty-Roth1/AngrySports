-- Expand player status to include specific IL designations
alter table players drop constraint if exists players_status_check;
alter table players add constraint players_status_check
  check (status in ('active','injured','IL10','IL60','minors','inactive','nl'));
