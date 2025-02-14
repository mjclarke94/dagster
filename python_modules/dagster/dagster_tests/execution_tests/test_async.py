import asyncio

from dagster import Output
from dagster._core.definitions.decorators import op
from dagster._utils.test import wrap_op_in_graph_and_execute


def test_aio_solid():
    @op
    async def aio_solid(_):
        await asyncio.sleep(0.01)
        return "done"

    result = wrap_op_in_graph_and_execute(aio_solid)
    assert result.output_value() == "done"


def test_aio_gen_solid():
    @op
    async def aio_gen(_):
        await asyncio.sleep(0.01)
        yield Output("done")

    result = wrap_op_in_graph_and_execute(aio_gen)
    assert result.output_value() == "done"
