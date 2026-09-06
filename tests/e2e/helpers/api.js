import { createClient } from '@supabase/supabase-js';

export class TestApi {
  constructor(supabaseUrl, serviceKey, tenantId) {
    this.tenantId = tenantId;
    this.client = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { 'X-App-Tenant': tenantId } }
    });
  }

  async getClientByName(name) {
    const { data, error } = await this.client
      .from('clients')
      .select('id, name')
      .ilike('name', name)
      .eq('tenant_id', this.tenantId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getProjectByName(name) {
    const { data, error } = await this.client
      .from('projects')
      .select('id, name, client_id')
      .ilike('name', name)
      .eq('tenant_id', this.tenantId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getVendorByName(name) {
    const { data, error } = await this.client
      .from('vendors')
      .select('id, name')
      .ilike('name', name)
      .eq('tenant_id', this.tenantId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getEmployeeByName(name) {
    const { data, error } = await this.client
      .from('employees')
      .select('id, name')
      .ilike('name', name)
      .eq('tenant_id', this.tenantId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getCustodyByEmployee(employeeId) {
    const { data, error } = await this.client
      .from('custody_records')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('tenant_id', this.tenantId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getTransactionsForProject(projectId) {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('project_id', projectId)
      .eq('tenant_id', this.tenantId)
      .is('deleted_at', null)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getProjectBalance(projectId) {
    const { data, error } = await this.client
      .from('project_balances')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) throw error;
    return data || { deposits: 0, expenses: 0, supervision: 0, retention_withheld: 0, retention_released: 0, balance: 0 };
  }

  async ensureSector(name) {
    const { data, error } = await this.client
      .from('sectors')
      .select('id')
      .ilike('name', name)
      .eq('tenant_id', this.tenantId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (data) return data.id;
    const { data: inserted, error: insertError } = await this.client
      .from('sectors')
      .insert({ name })
      .select('id')
      .single();
    if (insertError) throw insertError;
    return inserted.id;
  }

  async ensureWorkSection(name) {
    const { data, error } = await this.client
      .from('work_sections')
      .select('id')
      .ilike('name', name)
      .eq('tenant_id', this.tenantId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (data) return data.id;
    const { data: inserted, error: insertError } = await this.client
      .from('work_sections')
      .insert({ name })
      .select('id')
      .single();
    if (insertError) throw insertError;
    return inserted.id;
  }

  async cleanupByPrefix(prefix) {
    const likePattern = `${prefix}%`;

    const [{ data: clients }, { data: projects }, { data: vendors }, { data: employees }, { data: items }, { data: sectors }] = await Promise.all([
      this.client.from('clients').select('id').ilike('name', likePattern).eq('tenant_id', this.tenantId).is('deleted_at', null),
      this.client.from('projects').select('id').ilike('name', likePattern).eq('tenant_id', this.tenantId).is('deleted_at', null),
      this.client.from('vendors').select('id').ilike('name', likePattern).eq('tenant_id', this.tenantId).is('deleted_at', null),
      this.client.from('employees').select('id').ilike('name', likePattern).eq('tenant_id', this.tenantId).is('deleted_at', null),
      this.client.from('items').select('id').ilike('name', likePattern).eq('tenant_id', this.tenantId).is('deleted_at', null),
      this.client.from('sectors').select('id').ilike('name', likePattern).eq('tenant_id', this.tenantId).is('deleted_at', null)
    ]);

    const clientIds = (clients || []).map((r) => r.id);
    const projectIds = (projects || []).map((r) => r.id);
    const vendorIds = (vendors || []).map((r) => r.id);
    const employeeIds = (employees || []).map((r) => r.id);
    const itemIds = (items || []).map((r) => r.id);
    const sectorIds = (sectors || []).map((r) => r.id);

    // Pull additional projects that belong to matching clients.
    if (clientIds.length) {
      const { data: extraProjects } = await this.client
        .from('projects')
        .select('id')
        .in('client_id', clientIds)
        .eq('tenant_id', this.tenantId)
        .is('deleted_at', null);
      projectIds.push(...(extraProjects || []).map((r) => r.id));
    }

    const allProjectIds = [...new Set(projectIds)];
    const allVendorIds = [...new Set(vendorIds)];
    const allEmployeeIds = [...new Set(employeeIds)];

    // Delete child records first.
    if (allProjectIds.length) {
      await this.client.from('project_period_closes').delete().in('project_id', allProjectIds).eq('tenant_id', this.tenantId);
      await this.client.from('project_section_supervision').delete().in('project_id', allProjectIds).eq('tenant_id', this.tenantId);
      await this.client.from('project_tasks').delete().in('project_id', allProjectIds).eq('tenant_id', this.tenantId);
    }

    if (allEmployeeIds.length) {
      const { data: custodyRecords } = await this.client
        .from('custody_records')
        .select('id')
        .in('employee_id', allEmployeeIds)
        .eq('tenant_id', this.tenantId)
        .is('deleted_at', null);
      const custodyIds = (custodyRecords || []).map((r) => r.id);
      if (custodyIds.length) {
        await this.client.from('custody_expenses').delete().in('custody_id', custodyIds);
        await this.client.from('custody_records').delete().in('id', custodyIds).eq('tenant_id', this.tenantId);
      }
      await this.client.from('attendance_records').delete().in('employee_id', allEmployeeIds).eq('tenant_id', this.tenantId);
      await this.client.from('payroll_records').delete().in('employee_id', allEmployeeIds).eq('tenant_id', this.tenantId);
      await this.client.from('employee_transactions').delete().in('employee_id', allEmployeeIds).eq('tenant_id', this.tenantId);
      await this.client.from('employee_salary_history').delete().in('employee_id', allEmployeeIds).eq('tenant_id', this.tenantId);
    }

    if (allProjectIds.length || allVendorIds.length || itemIds.length || sectorIds.length) {
      const buildTxQuery = (linkedOnly) => {
        let txQuery = this.client.from('transactions').delete().eq('tenant_id', this.tenantId);
        if (linkedOnly) {
          txQuery = txQuery.not('linked_transaction_id', 'is', null);
        } else {
          txQuery = txQuery.is('linked_transaction_id', null);
        }
        const orFilters = [];
        if (allProjectIds.length) orFilters.push(`project_id.in.(${allProjectIds.join(',')})`);
        if (allVendorIds.length) orFilters.push(`vendor_id.in.(${allVendorIds.join(',')})`);
        if (clientIds.length) orFilters.push(`client_id.in.(${clientIds.join(',')})`);
        if (itemIds.length) orFilters.push(`item_id.in.(${itemIds.join(',')})`);
        if (sectorIds.length) orFilters.push(`sector_id.in.(${sectorIds.join(',')})`);
        if (allEmployeeIds.length) orFilters.push(`employee_id.in.(${allEmployeeIds.join(',')})`);
        if (orFilters.length) {
          txQuery = txQuery.or(orFilters.join(','));
        }
        return txQuery;
      };
      // Delete child/linked transactions first to avoid self-reference FK errors.
      await buildTxQuery(true);
      await buildTxQuery(false);

      let procQuery = this.client.from('procurements').delete().eq('tenant_id', this.tenantId);
      const procFilters = [];
      if (allProjectIds.length) procFilters.push(`project_id.in.(${allProjectIds.join(',')})`);
      if (allVendorIds.length) procFilters.push(`vendor_id.in.(${allVendorIds.join(',')})`);
      if (itemIds.length) procFilters.push(`item_id.in.(${itemIds.join(',')})`);
      if (procFilters.length) {
        procQuery = procQuery.or(procFilters.join(','));
      }
      await procQuery;
    }

    // Finally delete the main records.
    if (allProjectIds.length) {
      await this.client.from('projects').delete().in('id', allProjectIds).eq('tenant_id', this.tenantId);
    }
    if (clientIds.length) {
      await this.client.from('clients').delete().in('id', clientIds).eq('tenant_id', this.tenantId);
    }
    if (allEmployeeIds.length) {
      await this.client.from('employees').delete().in('id', allEmployeeIds).eq('tenant_id', this.tenantId);
    }
    if (allVendorIds.length) {
      await this.client.from('vendors').delete().in('id', allVendorIds).eq('tenant_id', this.tenantId);
    }
    if (itemIds.length) {
      await this.client.from('items').delete().in('id', itemIds).eq('tenant_id', this.tenantId);
    }
    if (sectorIds.length) {
      await this.client.from('sectors').delete().in('id', sectorIds).eq('tenant_id', this.tenantId);
    }
  }
}
