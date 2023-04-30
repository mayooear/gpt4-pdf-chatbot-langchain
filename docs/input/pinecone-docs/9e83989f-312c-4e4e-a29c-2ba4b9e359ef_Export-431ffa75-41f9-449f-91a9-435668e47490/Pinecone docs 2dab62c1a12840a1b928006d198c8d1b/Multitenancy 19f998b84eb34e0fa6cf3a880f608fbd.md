# Multitenancy

# URL:[https://docs.pinecone.io/docs/multitenancy](https://docs.pinecone.io/docs/multitenancy)

# Multitenancy

In Pinecone, multitenancy allows multiple tenants (e.g., customers, users, or applications) to share a single Pinecone instance while maintaining isolation and separation of resources.

## How multitenancy works

In Pinecone, multitenancy is implemented using projects and organizations. Each tenant is assigned to a project and an organization, which allows them to access and manage their own resources within the shared Pinecone instance.

Each project and organization can have its own set of permissions and access controls, which allows for fine-grained control over who can access and modify resources within each tenant.

## Creating tenants

To create a new tenant in Pinecone, you can create a new project and organization for the tenant. You can then assign users or organizations to the project and set their roles and permissions.

## Managing tenants

Once you have created a tenant in Pinecone, you can manage the tenant's resources and permissions using the Pinecone console or the API. You can assign permissions to users or organizations for the tenant's resources, and you can set quotas and limits for the tenant's usage of the Pinecone instance.

## Next steps

To learn more about using multitenancy in Pinecone, check out the [documentation](https://docs.pinecone.io/docs/multitenancy). If you have any questions or feedback, please [contact us](https://www.pinecone.io/contact/).