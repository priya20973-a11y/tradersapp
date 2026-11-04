import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Customer, SalesDocument } from "@/models";
import { getSalesScope, respondError } from "../../sales-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return respondError("Customer ID is required.", 400);

    const session = await getServerSession(authOptions);
    if (!session?.user) return respondError("Sign in to access customer details.", 401);

    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get("organizationId") ?? undefined;
    const scope = await getSalesScope(requestedOrgId, session);
    if ("error" in scope) return scope.error;

    await connectToDatabase();

    const query: Record<string, unknown> = {
      organizationId: scope.organizationId,
    };
    if (isValidObjectId(id)) {
      query._id = new Types.ObjectId(id);
    } else {
      query._id = id;
    }

    const customer = await Customer.findOne(query).lean();
    if (!customer) return respondError("Customer not found.", 404);

    const customerDocQuery = {
      organizationId: scope.organizationId,
      customerId: String(customer._id),
    };

    const documents = await SalesDocument.find(customerDocQuery)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      customer: {
        id: String(customer._id),
        name: customer.name,
        customerType: customer.customerType ?? "Business",
        companyName: customer.companyName ?? "",
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        mobile: customer.mobile ?? "",
        openingBalance: Number(customer.openingBalance ?? 0),
        creditLimit: Number(customer.creditLimit ?? 0),
        unusedCredits: Number(customer.unusedCredits ?? 0),
        status: customer.status ?? "Active",
        gstin: customer.gstin ?? "",
        pan: customer.pan ?? "",
        state: customer.state ?? "",
        customerLanguage: customer.customerLanguage ?? "English",
        currency: customer.currency ?? "INR",
        paymentTerms: customer.paymentTerms ?? "Due on Receipt",
        billingAddress: customer.billingAddress,
        shippingAddress: customer.shippingAddress,
        contactPersons: customer.contactPersons ?? [],
        customFields: customer.customFields ?? [],
        reportingTags: customer.reportingTags ?? [],
        remarks: customer.remarks ?? "",
        comments: (customer as Record<string, unknown>).comments ?? [],
        createdAt: customer.createdAt ? new Date(String(customer.createdAt)).toISOString() : "",
        updatedAt: customer.updatedAt ? new Date(String(customer.updatedAt)).toISOString() : "",
      },
      documents: documents.map((doc) => ({
        id: String(doc._id),
        type: doc.type,
        number: doc.number,
        customerId: String(doc.customerId),
        total: Number(doc.total ?? 0),
        amountPaid: Number(doc.amountPaid ?? 0),
        creditedAmount: Number(doc.creditedAmount ?? 0),
        status: doc.status,
        issueDate: doc.issueDate?.toISOString() ?? "",
        dueDate: doc.dueDate?.toISOString() ?? "",
        paymentDate: doc.paymentDate?.toISOString() ?? "",
        method: doc.method ?? "",
        referenceNumber: doc.referenceNumber ?? "",
        notes: doc.notes ?? "",
        createdAt: doc.createdAt ? new Date(String(doc.createdAt)).toISOString() : "",
      })),
    });
  } catch (error) {
    return respondError(error instanceof Error ? error.message : "Internal Server Error", 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return respondError("Customer ID is required.", 400);

    const session = await getServerSession(authOptions);
    if (!session?.user) return respondError("Sign in to update customer.", 401);

    const body = await request.json();
    const scope = await getSalesScope(body.organizationId, session);
    if ("error" in scope) return scope.error;

    await connectToDatabase();

    const query: Record<string, unknown> = {
      organizationId: scope.organizationId,
    };
    if (isValidObjectId(id)) {
      query._id = new Types.ObjectId(id);
    } else {
      query._id = id;
    }

    // Handle adding a new comment
    if (body.action === "add-comment" && body.commentText) {
      const commentObj = {
        text: String(body.commentText).trim(),
        author: session.user.name || session.user.email || "User",
        createdAt: new Date(),
      };

      const updated = await Customer.findOneAndUpdate(
        query,
        { $push: { comments: commentObj } },
        { new: true },
      ).lean();

      if (!updated) return respondError("Customer not found.", 404);
      return NextResponse.json({ ok: true, comment: commentObj });
    }

    // Standard profile update
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      "name",
      "customerType",
      "companyName",
      "email",
      "phone",
      "mobile",
      "gstin",
      "pan",
      "state",
      "customerLanguage",
      "currency",
      "paymentTerms",
      "openingBalance",
      "creditLimit",
      "status",
      "billingAddress",
      "shippingAddress",
      "contactPersons",
      "customFields",
      "reportingTags",
      "remarks",
    ];

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    const updatedCustomer = await Customer.findOneAndUpdate(
      query,
      { $set: updateData },
      { new: true },
    ).lean();

    if (!updatedCustomer) return respondError("Customer not found.", 404);

    return NextResponse.json({ ok: true, customer: updatedCustomer });
  } catch (error) {
    return respondError(error instanceof Error ? error.message : "Internal Server Error", 500);
  }
}
